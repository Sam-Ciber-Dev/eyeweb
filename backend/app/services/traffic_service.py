"""
===========================================
Eye Web Backend — Traffic Monitoring Service
===========================================
Handles request logging, suspicious activity detection,
IP blocking, VPN/proxy detection, and geo-lookup.

Used by the traffic middleware (main.py) and
the traffic router (routers/traffic_router.py).
"""

import os
import time
import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from ipaddress import ip_address, ip_network
from typing import Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# ─── PATHS TO SKIP (avoid feedback loops) ────────────
SKIP_PATHS = {"/docs", "/redoc", "/openapi.json", "/health"}
SKIP_PREFIXES = ("/api/admin/traffic", "/api/admin-heartbeat", "/api/visit", "/api/heartbeat", "/api/check-ip", "/api/register-fingerprint")

# ─── INFRA CIDRs (skip threat detection for infra IPs) ───
_INFRA_NETS = [
    ip_network("3.0.0.0/8"),
    ip_network("13.32.0.0/11"),
    ip_network("15.0.0.0/8"),
    ip_network("18.0.0.0/8"),
    ip_network("34.0.0.0/8"),
    ip_network("35.0.0.0/8"),
    ip_network("44.192.0.0/10"),
    ip_network("51.44.0.0/16"),
    ip_network("52.0.0.0/8"),
    ip_network("54.0.0.0/8"),
    ip_network("66.102.0.0/16"),
    ip_network("66.249.0.0/16"),
    ip_network("142.250.0.0/15"),
    ip_network("104.40.0.0/13"),
    ip_network("104.208.0.0/13"),
]

def _is_infra(ip_str: str) -> bool:
    try:
        addr = ip_address(ip_str)
        return any(addr in net for net in _INFRA_NETS)
    except (ValueError, TypeError):
        return False

# ─── THREAT SIGNATURES ───────────────────────────────
SCANNER_AGENTS = [
    "nmap", "nikto", "sqlmap", "dirbuster", "gobuster",
    "wpscan", "masscan", "zmap", "shodan", "censys",
    "nuclei", "ffuf", "feroxbuster", "burpsuite", "hydra",
    "metasploit", "openvas", "nessus", "qualys", "acunetix",
]

SQL_PATTERNS = [
    "' or ", "' and ", "union select", "drop table",
    "insert into", "delete from", "1=1", "' or '1'='1",
    "char(", "concat(", "benchmark(", "sleep(",
    "waitfor delay", "pg_sleep", "load_file", "0x",
]

PATH_TRAVERSAL = ["../", "..\\", "%2e%2e", "%252e"]

# Expanded path traversal targets (case-insensitive match on decoded path)
PATH_TRAVERSAL_TARGETS = [
    "/etc/passwd", "/etc/shadow", "/etc/hosts",
    "/proc/self", "/proc/version", "/proc/cpuinfo",
    "/var/log/", "/var/www/", "/usr/local/",
    "c:\\windows", "c:/windows", "boot.ini",
    "win.ini", "web.config",
]

# ─── Suspicious paths (common scan/recon targets) ───
SUSPICIOUS_PATHS = [
    # CMS / framework probes
    "/wp-admin", "/wp-login", "/wp-content", "/wp-includes",
    "/wordpress", "/wp-json", "/xmlrpc.php",
    "/administrator", "/joomla", "/drupal",
    # Config / secret files
    "/.env", "/.git", "/.svn", "/.htaccess", "/.htpasswd",
    "/.DS_Store", "/config.php", "/config.yml", "/config.json",
    "/database.yml", "/settings.py", "/web.config",
    "/composer.json", "/package.json", "/.npmrc",
    # Server info / debug
    "/phpinfo", "/phpmyadmin", "/pma", "/adminer",
    "/server-status", "/server-info", "/_debug",
    "/actuator", "/swagger", "/graphql",
    # Shell / backdoor probes
    "/shell", "/cmd", "/command", "/eval",
    "/c99", "/r57", "/webshell", "/backdoor",
    "/filemanager", "/upload.php",
    # Common vulnerability paths
    "/cgi-bin/", "/console", "/debug/", "/trace",
    "/solr/", "/jenkins/", "/manager/html",
    "/invoker/", "/jmx-console", "/status",
    "/.well-known/", "/telescope/",
]

# ─── THRESHOLDS ──────────────────────────────────────
RATE_LIMIT_WINDOW = 60       # seconds
RATE_LIMIT_MAX = 100         # requests per window
RATE_LIMIT_AUTOBLOCK = 200   # auto-block at 2x
BRUTE_FORCE_WINDOW = 300     # 5 minutes
BRUTE_FORCE_MAX = 10         # login attempts

# ─── FINGERPRINT WEIGHTS (fuzzy matching) ────────────
# Total = 100 pontos. Threshold ≥70 = mesmo dispositivo.
FP_WEIGHTS = {
    "canvas": 25,     # Canvas rendering (GPU/driver dependent)
    "webgl": 30,      # GPU vendor~renderer (hardware unique)
    "audio": 20,      # Audio context (DAC/driver unique)
    "screen": 10,     # Screen resolution + color depth
    "cpu": 5,         # CPU cores
    "ram": 3,         # RAM (deviceMemory)
    "tz": 3,          # Timezone
    "platform": 2,    # OS platform
    "ua": 2,          # User-Agent (changes with updates)
}
FP_MATCH_THRESHOLD = 70      # minimum score to consider same device


class TrafficService:
    """
    Singleton service for traffic monitoring.
    
    - Logs every request to Supabase (fire-and-forget)
    - Tracks request rates per IP in memory
    - Detects suspicious patterns (scanners, SQLi, brute force, etc.)
    - Auto-blocks IPs that exceed thresholds
    - Geo-locates IPs and detects VPN/proxy
    - Caches geo data in Supabase + memory
    """

    _instance: Optional["TrafficService"] = None

    @classmethod
    def get(cls) -> "TrafficService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self._url = os.getenv("SUPABASE_URL", "")
        self._key = os.getenv("SUPABASE_SERVICE_KEY", "")
        self._headers = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        # In-memory state
        self.blocked_ips: set = set()
        self._req_counts: Dict[str, list] = defaultdict(list)
        self._geo_cache: Dict[str, dict] = {}
        self._heartbeats: Dict[str, float] = {}  # ip → last heartbeat timestamp
        self._admin_ips: Dict[str, float] = {}    # ip → last admin heartbeat timestamp
        self._admin_fps: Dict[str, float] = {}    # fingerprint_hash → last admin heartbeat timestamp
        self._fp_last_ip: Dict[str, str] = {}        # fingerprint_hash → last known IP (VPN toggle detection)
        self.blocked_devices: set = set()  # fingerprint hashes bloqueados
        self.blocked_hardware_hashes: set = set()  # hardware hashes bloqueados (anti browser-switch)
        self._blocked_fp_components: Dict[str, dict] = {}  # fp_hash → components (para fuzzy matching)
        self._fp_ip_map: Dict[str, set] = {}  # fp_hash → set of IPs associados
        self._initialized = False

    @property
    def _configured(self) -> bool:
        return bool(self._url and self._key)

    # ═══════════════════════════════════════════════════
    # INITIALIZATION
    # ═══════════════════════════════════════════════════

    async def init(self):
        """Load blocked IPs and devices from Supabase on startup."""
        if self._initialized or not self._configured:
            return
        await self._refresh_blocked()
        await self._refresh_blocked_devices()
        self._initialized = True
        logger.info(f"🛡️  Traffic monitor initialized ({len(self.blocked_ips)} IPs, {len(self.blocked_devices)} devices, {len(self.blocked_hardware_hashes)} hw-hashes bloqueados)")

    async def _refresh_blocked(self):
        """Refresh blocked IPs cache from Supabase."""
        try:
            async with httpx.AsyncClient() as c:
                r = await c.get(
                    f"{self._url}/rest/v1/traffic_blocked_ips?select=ip",
                    headers=self._headers, timeout=5.0,
                )
                if r.status_code == 200:
                    self.blocked_ips = {row["ip"] for row in r.json()}
        except Exception as e:
            logger.warning(f"Failed to load blocked IPs: {e}")

    async def _refresh_blocked_devices(self):
        """Refresh blocked device fingerprints cache from Supabase."""
        try:
            async with httpx.AsyncClient() as c:
                r = await c.get(
                    f"{self._url}/rest/v1/traffic_blocked_devices?select=fingerprint_hash,components,associated_ips",
                    headers=self._headers, timeout=5.0,
                )
                if r.status_code == 200:
                    data = r.json()
                    self.blocked_devices = {row["fingerprint_hash"] for row in data}
                    self._blocked_fp_components = {
                        row["fingerprint_hash"]: row.get("components", {})
                        for row in data if row.get("components")
                    }
                    # Extrair hardware hashes de componentes bloqueados (anti browser-switch)
                    self.blocked_hardware_hashes = set()
                    for row in data:
                        comps = row.get("components") or {}
                        hw_hash = comps.get("hardware_hash", "")
                        if hw_hash:
                            self.blocked_hardware_hashes.add(hw_hash)
                    # Também guardar mapa de IPs por fingerprint
                    for row in data:
                        fp = row["fingerprint_hash"]
                        ips = row.get("associated_ips") or []
                        self._fp_ip_map[fp] = set(ips)
        except Exception as e:
            logger.warning(f"Failed to load blocked devices: {e}")

    # ═══════════════════════════════════════════════════
    # CORE — called by middleware
    # ═══════════════════════════════════════════════════

    def is_blocked(self, ip: str) -> bool:
        return ip in self.blocked_ips

    _LOCALHOST = {"127.0.0.1", "::1", "localhost", "unknown", ""}

    def heartbeat(self, ip: str, fp: str = ""):
        """Record a heartbeat. Tracks by fingerprint when available, falls back to IP."""
        now = time.time()
        # Track fingerprint heartbeat even for localhost (per-device accuracy)
        if fp:
            self._heartbeats[f"fp:{fp}"] = now
        if ip in self._LOCALHOST:
            return  # Ignorar IP localhost para contagem de IPs
        # Always track IP heartbeat (fallback for connections without FP)
        self._heartbeats[ip] = now
        # Cleanup stale heartbeats (> 5 min)
        if len(self._heartbeats) > 10000:
            cutoff = now - 300
            self._heartbeats = {k: v for k, v in self._heartbeats.items() if v > cutoff}

    def is_online(self, ip: str) -> bool:
        """Check if IP sent a heartbeat in the last 60 seconds."""
        last = self._heartbeats.get(ip, 0)
        return (time.time() - last) < 60

    def is_online_fp(self, fp: str) -> bool:
        """Check if fingerprint sent a heartbeat in the last 60 seconds."""
        if not fp:
            return False
        last = self._heartbeats.get(f"fp:{fp}", 0)
        return (time.time() - last) < 60

    def get_last_ip(self, fp: str) -> str:
        """Get the last known IP for a fingerprint."""
        return self._fp_last_ip.get(fp, "")

    def set_last_ip(self, fp: str, ip: str):
        """Set the last known IP for a fingerprint."""
        self._fp_last_ip[fp] = ip
        # Cleanup if too many entries
        if len(self._fp_last_ip) > 10000:
            self._fp_last_ip = dict(list(self._fp_last_ip.items())[-5000:])

    def register_admin_ip(self, ip: str):
        """Tag an IP as belonging to a verified admin."""
        if ip in self._LOCALHOST:
            return
        self._admin_ips[ip] = time.time()

    def register_admin_fp(self, fp: str):
        """Tag a fingerprint as belonging to a verified admin."""
        if not fp:
            return
        self._admin_fps[fp] = time.time()
        logger.info(f"\U0001f6e1\ufe0f Admin FP registado: {fp[:12]}...")

    def is_admin_ip(self, ip: str) -> bool:
        """Check if IP is a known admin (heartbeat within last 5 minutes)."""
        last = self._admin_ips.get(ip, 0)
        return (time.time() - last) < 300  # 5 min window

    def is_admin_fp(self, fp: str) -> bool:
        """Check if fingerprint belongs to a verified admin."""
        if not fp:
            return False
        last = self._admin_fps.get(fp, 0)
        return (time.time() - last) < 300  # 5 min window

    def online_count(self) -> int:
        """Count unique IPs with active heartbeat (online right now)."""
        cutoff = time.time() - 60
        return sum(1 for v in self._heartbeats.values() if v > cutoff)

    def should_log(self, path: str) -> bool:
        if path in SKIP_PATHS:
            return False
        return not any(path.startswith(p) for p in SKIP_PREFIXES)

    async def safe_log_request(self, **kwargs):
        """Fire-and-forget wrapper — never raises exceptions."""
        try:
            await self._log_request(**kwargs)
        except Exception as e:
            logger.debug(f"Traffic log error (non-critical): {e}")

    async def _log_request(self, ip: str, method: str, path: str,
                           status_code: int, user_agent: str, response_time_ms: int,
                           fingerprint_hash: str = ""):
        """Log a request and check for suspicious activity."""
        if not self._configured:
            return

        # ─── Ignorar localhost (chamadas internas server-to-server) ───
        if ip in self._LOCALHOST:
            return

        now = time.time()

        # ─── Record heartbeat (any request = alive) ───
        self._heartbeats[ip] = now

        # ─── Track request rate (keep 5 min window) ───
        self._req_counts[ip].append(now)
        cutoff = now - 300
        self._req_counts[ip] = [t for t in self._req_counts[ip] if t > cutoff]

        # Cleanup stale IPs if memory grows too large
        if len(self._req_counts) > 5000:
            for k in list(self._req_counts.keys()):
                self._req_counts[k] = [t for t in self._req_counts[k] if t > cutoff]
                if not self._req_counts[k]:
                    del self._req_counts[k]

        # ─── Geo lookup (cached) ───
        geo = await self._geo_lookup(ip)

        # ─── Insert log to Supabase ───
        try:
            log_data = {
                "ip": ip,
                "method": method,
                "path": path,
                "status_code": status_code,
                "user_agent": (user_agent or "")[:500],
                "country": geo.get("country", ""),
                "city": geo.get("city", ""),
                "is_vpn": geo.get("is_vpn", False),
                "vpn_provider": geo.get("provider", ""),
                "response_time_ms": response_time_ms,
            }
            if fingerprint_hash:
                log_data["fingerprint_hash"] = fingerprint_hash
            async with httpx.AsyncClient() as c:
                await c.post(
                    f"{self._url}/rest/v1/traffic_logs",
                    headers=self._headers,
                    json=log_data,
                    timeout=5.0,
                )
                # ─── Persist fingerprint→IP association (upsert) ───
                if fingerprint_hash and ip:
                    # Atualizar mapa em memória (para block_device ter todos os IPs)
                    if fingerprint_hash not in self._fp_ip_map:
                        self._fp_ip_map[fingerprint_hash] = set()
                    self._fp_ip_map[fingerprint_hash].add(ip)
                    try:
                        await c.post(
                            f"{self._url}/rest/v1/traffic_device_ips",
                            headers={**self._headers, "Prefer": "return=minimal,resolution=merge-duplicates"},
                            json={
                                "fingerprint_hash": fingerprint_hash,
                                "ip": ip,
                                "is_vpn": geo.get("is_vpn", False),
                                "country": geo.get("country", ""),
                                "city": geo.get("city", ""),
                            },
                            timeout=3.0,
                        )
                    except Exception:
                        pass
        except Exception:
            pass  # Fire-and-forget

        # ─── Suspicious detection ───
        await self._detect_suspicious(ip, method, path, user_agent, now, geo, fingerprint_hash)

    # ═══════════════════════════════════════════════════
    # SUSPICIOUS ACTIVITY DETECTION
    # ═══════════════════════════════════════════════════

    async def _detect_suspicious(self, ip: str, method: str, path: str,
                                  user_agent: str, now: float,
                                  geo: dict | None = None,
                                  fingerprint_hash: str = ""):
        """Detect attack patterns and auto-block if necessary."""
        # IPs de infraestrutura nunca são tratados como suspeitos
        if _is_infra(ip):
            return
        # PAGE entries vêm do nosso próprio código (PageTracker) — não são ataques
        if method == "PAGE":
            return

        geo = geo or {}
        fp = fingerprint_hash or ""
        events = []

        # 1. Rate limiting (>100 req/min)
        recent_60s = [t for t in self._req_counts.get(ip, []) if now - t < RATE_LIMIT_WINDOW]
        if len(recent_60s) > RATE_LIMIT_MAX:
            events.append({
                "ip": ip, "event": "rate_limit", "severity": "high",
                "details": f"{len(recent_60s)} requests em {RATE_LIMIT_WINDOW}s (limite: {RATE_LIMIT_MAX})",
                "path": path,
                "_auto_block": len(recent_60s) > RATE_LIMIT_AUTOBLOCK,
            })

        # 2. Scanner detection (known tools in User-Agent)
        #    → Apenas alerta, NÃO bloqueia automaticamente
        ua_lower = (user_agent or "").lower()
        for scanner in SCANNER_AGENTS:
            if scanner in ua_lower:
                events.append({
                    "ip": ip, "event": "scanner", "severity": "high",
                    "details": f"Scanner detetado: {scanner}",
                    "path": path, "_auto_block": False,
                })
                break

        # 3. SQL Injection patterns in path or query
        check_str = path.lower() + " " + ua_lower
        for pattern in SQL_PATTERNS:
            if pattern in check_str:
                events.append({
                    "ip": ip, "event": "sql_injection", "severity": "critical",
                    "details": f"Padrão SQL injection detetado: {pattern}",
                    "path": path, "_auto_block": True,
                })
                break

        # 4. Path traversal attempts (../ patterns)
        #    → Apenas alerta, NÃO bloqueia automaticamente
        path_lower = path.lower()
        for pattern in PATH_TRAVERSAL:
            if pattern in path_lower:
                events.append({
                    "ip": ip, "event": "path_traversal", "severity": "high",
                    "details": f"Tentativa de path traversal: {pattern}",
                    "path": path, "_auto_block": False,
                })
                break

        # 4b. Path traversal targets (e.g. /etc/passwd, /etc/../passwd)
        #     Decode common URL encodings first, then normalize
        import urllib.parse
        decoded_path = urllib.parse.unquote(urllib.parse.unquote(path_lower))
        # Collapse /etc/../etc/passwd → /etc/passwd style patterns
        # by checking if any target appears in any form
        for target in PATH_TRAVERSAL_TARGETS:
            if target in decoded_path:
                events.append({
                    "ip": ip, "event": "path_traversal", "severity": "high",
                    "details": f"Acesso a ficheiro sensível: {target}",
                    "path": path, "_auto_block": False,
                })
                break

        # 5. Brute force (multiple POSTs to auth endpoints)
        if method == "POST" and any(p in path for p in ["/login", "/auth/", "/signin", "/send-code", "/verify"]):
            login_key = f"_login_{ip}"
            self._req_counts[login_key].append(now)
            self._req_counts[login_key] = [
                t for t in self._req_counts[login_key]
                if now - t < BRUTE_FORCE_WINDOW
            ]
            if len(self._req_counts[login_key]) > BRUTE_FORCE_MAX:
                events.append({
                    "ip": ip, "event": "brute_force", "severity": "critical",
                    "details": f"{len(self._req_counts[login_key])} tentativas de login em 5 minutos",
                    "path": path, "_auto_block": True,
                })

        # 6. Suspicious path probing (unknown scanners — behavioral detection)
        #    Detects bots probing for common CMS, config files, shells, etc.
        #    → Apenas alerta; com scan repetitivo → auto-block
        for susp_path in SUSPICIOUS_PATHS:
            if susp_path in path_lower:
                # Track how many different suspicious paths this IP has hit
                probe_key = f"_probe_{ip}"
                if probe_key not in self._req_counts:
                    self._req_counts[probe_key] = []
                # Store the path as a string entry for counting unique paths
                if path_lower not in [str(x) for x in self._req_counts[probe_key] if isinstance(x, str)]:
                    self._req_counts[probe_key].append(path_lower)
                unique_probes = len([x for x in self._req_counts[probe_key] if isinstance(x, str)])
                events.append({
                    "ip": ip, "event": "recon_probe", "severity": "medium" if unique_probes < 5 else "high",
                    "details": f"Path suspeito: {susp_path} ({unique_probes} paths únicos sondados)",
                    "path": path,
                    "_auto_block": unique_probes >= 5,  # 5+ caminhos diferentes = scan ativo → bloquear
                })
                break

        # 7. Empty/bot User-Agent heuristic
        #    Requests with no UA or with generic single-word UAs are suspicious
        if not user_agent or user_agent.strip() == "" or (len(user_agent) < 10 and " " not in user_agent):
            # Only flag if combined with non-standard path
            if path_lower not in ("/", "/api/health", "/favicon.ico", "/robots.txt"):
                events.append({
                    "ip": ip, "event": "suspicious_ua", "severity": "low",
                    "details": f"User-Agent suspeito: '{user_agent or '(vazio)'}' em {path}",
                    "path": path, "_auto_block": False,
                })

        # ─── Process events ───
        for event in events:
            auto_block = event.pop("_auto_block", False)

            # Insert to suspicious table (include geo data + fingerprint)
            event["country"] = geo.get("country", "")
            event["city"] = geo.get("city", "")
            event["is_vpn"] = geo.get("is_vpn", False)
            if fp:
                event["fingerprint_hash"] = fp
            try:
                async with httpx.AsyncClient() as c:
                    await c.post(
                        f"{self._url}/rest/v1/traffic_suspicious",
                        headers=self._headers,
                        json=event, timeout=5.0,
                    )
            except Exception:
                pass

            # Auto-block if threshold exceeded (nunca bloquear admins)
            if auto_block and ip not in self.blocked_ips and not self.is_admin_ip(ip):
                await self.block_ip(ip, f"Auto: {event['event']}", "system")

    # ═══════════════════════════════════════════════════
    # GEO / VPN LOOKUP
    # ═══════════════════════════════════════════════════

    async def _geo_lookup(self, ip: str) -> dict:
        """Get country, city, VPN status for an IP (with caching)."""
        # Skip local/private IPs
        if ip in ("127.0.0.1", "::1", "localhost") or ip.startswith(("192.168.", "10.", "172.")):
            return {"country": "Local", "city": "", "is_vpn": False, "provider": ""}

        # Memory cache
        if ip in self._geo_cache:
            return self._geo_cache[ip]

        # Cap cache size
        if len(self._geo_cache) > 10000:
            self._geo_cache.clear()

        # DB cache (traffic_vpn_cache table)
        try:
            async with httpx.AsyncClient() as c:
                r = await c.get(
                    f"{self._url}/rest/v1/traffic_vpn_cache?ip=eq.{ip}&select=*",
                    headers=self._headers, timeout=3.0,
                )
                if r.status_code == 200 and r.json():
                    d = r.json()[0]
                    result = {
                        "country": d.get("country", ""),
                        "city": d.get("city", ""),
                        "is_vpn": d.get("is_vpn", False),
                        "provider": d.get("provider", ""),
                    }
                    self._geo_cache[ip] = result
                    return result
        except Exception:
            pass

        # External API: ip-api.com (free, 45 req/min)
        try:
            async with httpx.AsyncClient() as c:
                r = await c.get(
                    f"http://ip-api.com/json/{ip}?fields=status,country,city,proxy,hosting,isp",
                    timeout=3.0,
                )
                if r.status_code == 200:
                    d = r.json()
                    if d.get("status") == "success":
                        is_vpn = d.get("proxy", False)
                        result = {
                            "country": d.get("country", "Desconhecido"),
                            "city": d.get("city", ""),
                            "is_vpn": is_vpn,
                            "provider": d.get("isp", "") if is_vpn else "",
                        }
                        # Save to DB cache
                        try:
                            await c.post(
                                f"{self._url}/rest/v1/traffic_vpn_cache",
                                headers={**self._headers, "Prefer": "return=minimal,resolution=merge-duplicates"},
                                json={
                                    "ip": ip, "is_vpn": is_vpn,
                                    "provider": result["provider"],
                                    "country": result["country"],
                                    "city": result["city"],
                                },
                                timeout=3.0,
                            )
                        except Exception:
                            pass
                        self._geo_cache[ip] = result
                        return result
        except Exception:
            pass

        return {"country": "Desconhecido", "city": "", "is_vpn": False, "provider": ""}

    # ═══════════════════════════════════════════════════
    # BLOCK / UNBLOCK
    # ═══════════════════════════════════════════════════

    async def block_ip(self, ip: str, reason: str, blocked_by: str = "admin"):
        """Block an IP address and save a snapshot of its recent logs."""
        if not self._configured:
            return

        geo = self._geo_cache.get(ip, {})
        req_count = len(self._req_counts.get(ip, []))

        # Get log snapshot (last 20 requests from this IP)
        log_snapshot = ""
        try:
            async with httpx.AsyncClient() as c:
                r = await c.get(
                    f"{self._url}/rest/v1/traffic_logs?ip=eq.{ip}&order=created_at.desc&limit=20&select=*",
                    headers={**self._headers, "Prefer": "return=representation"},
                    timeout=5.0,
                )
                if r.status_code == 200:
                    log_snapshot = json.dumps(r.json(), indent=2, default=str)
        except Exception:
            pass

        # Insert into blocked_ips (UPSERT)
        try:
            async with httpx.AsyncClient() as c:
                await c.post(
                    f"{self._url}/rest/v1/traffic_blocked_ips",
                    headers={**self._headers, "Prefer": "return=minimal,resolution=merge-duplicates"},
                    json={
                        "ip": ip,
                        "reason": reason,
                        "blocked_by": blocked_by,
                        "request_count": req_count,
                        "country": geo.get("country", ""),
                        "is_vpn": geo.get("is_vpn", False),
                        "log_snapshot": log_snapshot,
                    },
                    timeout=5.0,
                )
        except Exception as e:
            logger.warning(f"Failed to block IP {ip}: {e}")

        self.blocked_ips.add(ip)
        logger.info(f"🚫 IP bloqueado: {ip} — {reason} ({blocked_by})")

    async def unblock_ip(self, ip: str):
        """Unblock an IP address."""
        if not self._configured:
            return
        try:
            async with httpx.AsyncClient() as c:
                await c.delete(
                    f"{self._url}/rest/v1/traffic_blocked_ips?ip=eq.{ip}",
                    headers=self._headers, timeout=5.0,
                )
        except Exception as e:
            logger.warning(f"Failed to unblock IP {ip}: {e}")

        self.blocked_ips.discard(ip)
        logger.info(f"✅ IP desbloqueado: {ip}")

    # ═══════════════════════════════════════════════════
    # DEVICE FINGERPRINTING
    # ═══════════════════════════════════════════════════

    def is_device_blocked(self, fp_hash: str) -> bool:
        """Check if a device fingerprint is blocked (exact match only)."""
        if not fp_hash:
            return False
        return fp_hash in self.blocked_devices

    def is_hardware_blocked(self, hw_hash: str) -> bool:
        """Check if a hardware fingerprint hash is blocked.
        Hardware hashes use ONLY browser-independent components (GPU, screen, CPU, RAM, etc.)
        so they survive browser changes. This catches VPN+new-browser evasion."""
        if not hw_hash:
            return False
        return hw_hash in self.blocked_hardware_hashes

    def _fuzzy_match_score(self, comp_a: dict, comp_b: dict) -> int:
        """
        Compare two fingerprint component sets using weighted scoring.
        Returns score 0-100. Higher = more similar.
        """
        score = 0
        for key, weight in FP_WEIGHTS.items():
            val_a = comp_a.get(key)
            val_b = comp_b.get(key)
            # Skip if either value is missing/empty/zero
            if not val_a or not val_b:
                continue
            if str(val_a) == str(val_b):
                score += weight
        return score

    async def register_fingerprint(self, ip: str, fp_hash: str, components: dict) -> bool:
        """
        Register/update a device fingerprint.
        Returns True if the device should be blocked.
        """
        if not self._configured or not fp_hash:
            return False

        # 1. Exact hash check
        if fp_hash in self.blocked_devices:
            return True

        # 1b. Hardware hash check (anti browser-switch)
        hw_hash = components.get("hardware_hash", "") if components else ""
        if hw_hash and hw_hash in self.blocked_hardware_hashes:
            logger.info(
                f"🔍 Hardware hash match: {hw_hash[:12]}... — same device, different browser"
            )
            await self.block_device(
                fp_hash,
                f"Auto: hardware match ({hw_hash[:12]}...)",
                "system",
                components=components,
            )
            if ip and ip not in self.blocked_ips:
                await self.block_ip(ip, f"Auto: hardware bloqueado ({hw_hash[:12]}...)", "system")
            return True

        # 2. Fuzzy matching against all blocked fingerprints
        if components:
            for blocked_hash, blocked_comps in self._blocked_fp_components.items():
                score = self._fuzzy_match_score(components, blocked_comps)
                if score >= FP_MATCH_THRESHOLD:
                    logger.info(
                        f"🔍 Fuzzy match: {fp_hash[:12]}... matches blocked "
                        f"{blocked_hash[:12]}... (score: {score}/100)"
                    )
                    await self.block_device(
                        fp_hash,
                        f"Auto: fuzzy match ({score}%) com {blocked_hash[:12]}...",
                        "system",
                        components=components,
                    )
                    # Também bloquear o IP atual
                    if ip and ip not in self.blocked_ips:
                        await self.block_ip(ip, f"Auto: device bloqueado ({fp_hash[:12]}...)", "system")
                    return True

        # 3. Store/update fingerprint no Supabase
        try:
            async with httpx.AsyncClient() as c:
                # Verificar se já existe
                r = await c.get(
                    f"{self._url}/rest/v1/traffic_device_fingerprints"
                    f"?fingerprint_hash=eq.{fp_hash}&select=ips",
                    headers=self._headers, timeout=3.0,
                )
                now_iso = datetime.now(timezone.utc).isoformat()

                if r.status_code == 200 and r.json():
                    # Update: adicionar IP se novo
                    existing_ips = r.json()[0].get("ips") or []
                    if ip and ip not in existing_ips:
                        existing_ips.append(ip)
                    await c.patch(
                        f"{self._url}/rest/v1/traffic_device_fingerprints"
                        f"?fingerprint_hash=eq.{fp_hash}",
                        headers=self._headers,
                        json={"ips": existing_ips, "last_seen": now_iso, "components": components},
                        timeout=3.0,
                    )
                else:
                    # Insert novo fingerprint
                    await c.post(
                        f"{self._url}/rest/v1/traffic_device_fingerprints",
                        headers={**self._headers, "Prefer": "return=minimal"},
                        json={
                            "fingerprint_hash": fp_hash,
                            "components": components,
                            "ips": [ip] if ip else [],
                        },
                        timeout=3.0,
                    )
        except Exception as e:
            logger.debug(f"Failed to register fingerprint: {e}")

        # Atualizar mapa local de IPs por fingerprint
        if ip:
            if fp_hash not in self._fp_ip_map:
                self._fp_ip_map[fp_hash] = set()
            self._fp_ip_map[fp_hash].add(ip)

        return False

    async def block_device(self, fp_hash: str, reason: str, blocked_by: str = "admin",
                           components: dict = None):
        """Block a device by fingerprint hash. Also blocks all associated IPs."""
        if not self._configured or not fp_hash:
            return

        # Obter IPs associados a este fingerprint
        associated_ips = list(self._fp_ip_map.get(fp_hash, set()))

        # Se não temos em memória, tentar obter do Supabase (traffic_device_ips)
        if not associated_ips:
            try:
                async with httpx.AsyncClient() as c:
                    r = await c.get(
                        f"{self._url}/rest/v1/traffic_device_ips"
                        f"?fingerprint_hash=eq.{fp_hash}&select=ip",
                        headers=self._headers, timeout=3.0,
                    )
                    if r.status_code == 200 and r.json():
                        associated_ips = [row["ip"] for row in r.json() if row.get("ip")]
            except Exception:
                pass
            # Fallback: também tentar a tabela antiga traffic_device_fingerprints
            if not associated_ips:
                try:
                    async with httpx.AsyncClient() as c:
                        r = await c.get(
                            f"{self._url}/rest/v1/traffic_device_fingerprints"
                            f"?fingerprint_hash=eq.{fp_hash}&select=ips,components",
                            headers=self._headers, timeout=3.0,
                        )
                        if r.status_code == 200 and r.json():
                            data = r.json()[0]
                            associated_ips = data.get("ips") or []
                            if not components:
                                components = data.get("components") or {}
                except Exception:
                    pass

        # Impedir bloqueio de dispositivos admin (apenas por fingerprint)
        if self.is_admin_fp(fp_hash):
            logger.warning(f"🛡️ Tentativa de bloquear dispositivo admin ignorada: {fp_hash[:12]}...")
            raise ValueError(f"Dispositivo {fp_hash[:12]}... pertence a um administrador e não pode ser bloqueado")

        # Inserir na tabela de dispositivos bloqueados (UPSERT)
        try:
            async with httpx.AsyncClient() as c:
                await c.post(
                    f"{self._url}/rest/v1/traffic_blocked_devices",
                    headers={**self._headers, "Prefer": "return=minimal,resolution=merge-duplicates"},
                    json={
                        "fingerprint_hash": fp_hash,
                        "reason": reason,
                        "blocked_by": blocked_by,
                        "components": components or {},
                        "associated_ips": associated_ips,
                    },
                    timeout=5.0,
                )
        except Exception as e:
            logger.warning(f"Failed to block device {fp_hash[:12]}...: {e}")

        # Também bloquear IPs associados (exceto IPs usados pelo admin)
        for ip in associated_ips:
            if ip and ip not in self.blocked_ips and not self.is_admin_ip(ip):
                await self.block_ip(ip, f"Device bloqueado: {fp_hash[:12]}...", blocked_by)

        # Atualizar cache em memória
        self.blocked_devices.add(fp_hash)
        if components:
            self._blocked_fp_components[fp_hash] = components
            # Também guardar hardware hash para deteção cross-browser
            hw_hash = components.get("hardware_hash", "")
            if hw_hash:
                self.blocked_hardware_hashes.add(hw_hash)

        logger.info(f"🚫 Device bloqueado: {fp_hash[:12]}... — {reason} ({blocked_by}) [{len(associated_ips)} IPs]")

    async def unblock_device(self, fp_hash: str):
        """Unblock a device and all its associated IPs."""
        if not self._configured or not fp_hash:
            return

        # Obter IPs associados antes de remover
        associated_ips = list(self._fp_ip_map.get(fp_hash, set()))
        if not associated_ips:
            try:
                async with httpx.AsyncClient() as c:
                    r = await c.get(
                        f"{self._url}/rest/v1/traffic_blocked_devices"
                        f"?fingerprint_hash=eq.{fp_hash}&select=associated_ips",
                        headers=self._headers, timeout=3.0,
                    )
                    if r.status_code == 200 and r.json():
                        associated_ips = r.json()[0].get("associated_ips") or []
            except Exception:
                pass

        # Remover da tabela de dispositivos bloqueados
        try:
            async with httpx.AsyncClient() as c:
                await c.delete(
                    f"{self._url}/rest/v1/traffic_blocked_devices?fingerprint_hash=eq.{fp_hash}",
                    headers=self._headers, timeout=5.0,
                )
        except Exception as e:
            logger.warning(f"Failed to unblock device {fp_hash[:12]}...: {e}")

        # Desbloquear todos os IPs associados
        for ip in associated_ips:
            await self.unblock_ip(ip)

        # Atualizar cache
        self.blocked_devices.discard(fp_hash)
        # Remover hardware hash associado
        old_comps = self._blocked_fp_components.pop(fp_hash, None)
        if old_comps:
            hw_hash = old_comps.get("hardware_hash", "")
            if hw_hash:
                self.blocked_hardware_hashes.discard(hw_hash)
        self._fp_ip_map.pop(fp_hash, None)

        logger.info(f"✅ Device desbloqueado: {fp_hash[:12]}... [{len(associated_ips)} IPs]")
