'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import './traffic.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── AUTH HELPER ───────────────────────────────────────
// Obtém o token Supabase para autenticar requests ao backend admin
async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { 'Authorization': `Bearer ${session.access_token}` };
    }
  } catch {}
  return {};
}

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface TrafficLog {
  id: number;
  ip: string;
  method: string;
  path: string;
  status_code: number;
  user_agent: string;
  country: string;
  city: string;
  is_vpn: boolean;
  vpn_provider: string;
  response_time_ms: number;
  created_at: string;
}

interface SuspiciousEvent {
  id: number;
  ip: string;
  event: string;
  severity: string;
  details: string;
  path: string;
  auto_blocked: boolean;
  created_at: string;
}

interface BlockedIP {
  id: number;
  ip: string;
  reason: string;
  blocked_by: string;
  request_count: number;
  country: string;
  is_vpn: boolean;
  log_snapshot: string;
  created_at: string;
}

interface Connection {
  fingerprint_hash: string;
  ips: string[];
  ip_details: { ip: string; is_vpn: boolean }[];
  country: string;
  city: string;
  is_vpn: boolean;
  vpn_provider: string;
  method: string;
  requests: number;
  online: boolean;
  is_admin: boolean;
}

interface BlockedDevice {
  id: number;
  fingerprint_hash: string;
  reason: string;
  blocked_by: string;
  components: Record<string, unknown>;
  associated_ips: string[];
  ip_details: { ip: string; is_vpn: boolean }[];
  created_at: string;
}

interface Stats {
  requests_today: number;
  active_ips_5m: number;
  suspicious_today: number;
  blocked_total: number;
}

interface DetailedLogEntry {
  _type: 'request' | 'threat';
  id: string;
  ip: string;
  timestamp: string;
  method: string;
  path: string;
  status_code: number;
  user_agent: string;
  country: string;
  city: string;
  is_vpn: boolean;
  vpn_provider: string;
  response_time_ms: number;
  fingerprint_hash: string;
  event: string | null;
  severity: string | null;
  details: string | null;
  auto_blocked: boolean;
}

type Tab = 'dashboard' | 'logs' | 'detailed' | 'blocked';

// ─── Chart color palette ───
const CHART_COLORS = ['#ff0000', '#ff4444', '#ff6666', '#ff8888', '#cc0000', '#990000', '#ff2222', '#dd3333'];
const THREAT_COLORS: Record<string, string> = {
  rate_limit: '#ff4444',
  scanner: '#ff8800',
  sql_injection: '#ff0000',
  path_traversal: '#cc0000',
  brute_force: '#ff2222',
  recon_probe: '#ff6600',
  suspicious_ua: '#ffaa00',
};
const THREAT_LABELS: Record<string, string> = {
  rate_limit: 'Rate Limit',
  scanner: 'Scanner',
  sql_injection: 'SQL Injection',
  path_traversal: 'Path Traversal',
  brute_force: 'Brute Force',
  recon_probe: 'Recon Probe',
  suspicious_ua: 'UA Suspeito',
};

interface ChartData {
  hourly_requests: { hour: string; requests: number }[];
  hourly_threats: { hour: string; threats: number }[];
  threat_distribution: { type: string; count: number }[];
  top_countries: { country: string; requests: number }[];
  vpn_stats: { vpn: number; direct: number };
  methods: { method: string; count: number }[];
  unique_ips_today: number;
  total_requests_today: number;
  total_threats_today: number;
  recent_blocks: number;
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export default function TrafficMonitorPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [detailedLogs, setDetailedLogs] = useState<DetailedLogEntry[]>([]);
  const [blocked, setBlocked] = useState<BlockedIP[]>([]);
  const [blockedDevices, setBlockedDevices] = useState<BlockedDevice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Detailed logs filters (client-side for instant UX)
  const [detailedFilter, setDetailedFilter] = useState('');
  const [detailedTypeFilter, setDetailedTypeFilter] = useState<'all' | 'request' | 'visit' | 'threat'>('all');

  // Block modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockTargetIp, setBlockTargetIp] = useState('');
  const [blockTargetFp, setBlockTargetFp] = useState('');
  const [blockReason, setBlockReason] = useState('');

  // Reason detail modal (for auto-blocked devices)
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonModalData, setReasonModalData] = useState<{ simple: string; detail: string }>({ simple: '', detail: '' });
  const [actionLoading, setActionLoading] = useState(false);

  // IP details modal
  const [showIpModal, setShowIpModal] = useState(false);
  const [ipModalData, setIpModalData] = useState<{ ip_details: { ip: string; is_vpn: boolean }[] }>({ ip_details: [] });

  // Post-block reason modal (appears after blocking without reason)
  const [showPostBlockReason, setShowPostBlockReason] = useState(false);
  const [postBlockFp, setPostBlockFp] = useState('');
  const [postBlockReasonText, setPostBlockReasonText] = useState('');
  const [postBlockSaving, setPostBlockSaving] = useState(false);

  // Edit reason modal (from blocked tab, clickable empty reason)
  const [showEditReason, setShowEditReason] = useState(false);
  const [editReasonFp, setEditReasonFp] = useState('');
  const [editReasonText, setEditReasonText] = useState('');
  const [editReasonSaving, setEditReasonSaving] = useState(false);

  // Dashboard chart data
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  // ─── HELPER: Parse auto-block reason into simple + detail ───
  const parseAutoReason = (reason: string): { simple: string; detail: string } => {
    if (reason.startsWith('Auto: fuzzy match'))
      return { simple: 'FingerPrint deu match com dispositivo bloqueado anteriormente', detail: reason };
    if (reason.startsWith('Auto: hardware match'))
      return { simple: 'Hardware deu match com dispositivo bloqueado anteriormente', detail: reason };
    if (reason.startsWith('Auto: rate_limit'))
      return { simple: 'Excedeu o limite de pedidos por minuto', detail: reason };
    if (reason.startsWith('Auto: scanner'))
      return { simple: 'Detetado scanner automático', detail: reason };
    if (reason.startsWith('Auto: sql_injection'))
      return { simple: 'Tentativa de SQL injection detetada', detail: reason };
    if (reason.startsWith('Auto: path_traversal'))
      return { simple: 'Tentativa de acesso a ficheiros do servidor', detail: reason };
    if (reason.startsWith('Auto: brute_force'))
      return { simple: 'Demasiadas tentativas de login', detail: reason };
    if (reason.startsWith('Auto:'))
      return { simple: 'Bloqueado automaticamente pelo sistema', detail: reason };
    return { simple: reason, detail: reason };
  };

  // ─── FETCH FUNCTIONS ─────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/admin/traffic/stats`, { headers });
      if (r.ok) setStats(await r.json());
    } catch {}
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      setError(null);
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/admin/traffic/connections`, { headers });
      if (r.ok) {
        const data = await r.json();
        setConnections(data.connections || []);
      }
    } catch {
      setError('Erro ao carregar conexões');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDetailedLogs = useCallback(async () => {
    try {
      setError(null);
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/admin/traffic/detailed-logs?limit=200`, { headers });
      if (r.ok) {
        const data = await r.json();
        setDetailedLogs(data.entries || []);
      }
    } catch {
      setError('Erro ao carregar logs detalhados');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBlocked = useCallback(async () => {
    try {
      setError(null);
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/admin/traffic/blocked`, { headers });
      if (r.ok) {
        const data = await r.json();
        setBlocked(data.blocked || []);
        setBlockedDevices(data.blocked_devices || []);
      }
    } catch {
      setError('Erro ao carregar bloqueados');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchChartData = useCallback(async () => {
    try {
      setChartLoading(true);
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/admin/traffic/chart-data`, { headers });
      if (r.ok) {
        setChartData(await r.json());
      }
    } catch {
      console.error('Erro ao carregar dados do grafico');
    } finally {
      setChartLoading(false);
      setIsLoading(false);
    }
  }, []);

  // ─── EFFECTS ─────────────────────────────────────────

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchChartData();
  }, [fetchStats, fetchChartData]);

  // Tab change
  useEffect(() => {
    setIsLoading(true);
    if (activeTab === 'dashboard') fetchChartData();
    else if (activeTab === 'logs') fetchConnections();
    else if (activeTab === 'detailed') fetchDetailedLogs();
    else fetchBlocked();
  }, [activeTab, fetchChartData, fetchConnections, fetchDetailedLogs, fetchBlocked]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const ms = activeTab === 'dashboard' ? 15000 : activeTab === 'logs' ? 5000 : activeTab === 'detailed' ? 3000 : 10000;
    const interval = setInterval(() => {
      fetchStats();
      if (activeTab === 'dashboard') fetchChartData();
      else if (activeTab === 'logs') fetchConnections();
      else if (activeTab === 'detailed') fetchDetailedLogs();
      else fetchBlocked();
    }, ms);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, fetchStats, fetchChartData, fetchConnections, fetchDetailedLogs, fetchBlocked]);

  // ─── ACTIONS ─────────────────────────────────────────

  const handleBlock = async () => {
    if (!blockTargetIp && !blockTargetFp) return;
    setActionLoading(true);
    const reason = blockReason.trim() || '';
    try {
      const authHeaders = await getAuthHeaders();
      if (blockTargetFp) {
        const r = await fetch(`${API}/api/admin/traffic/block-device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ fingerprint_hash: blockTargetFp, reason }),
        });
        if (r.ok) {
          const fpToPrompt = blockTargetFp;
          setShowBlockModal(false);
          setBlockTargetIp('');
          setBlockTargetFp('');
          setBlockReason('');
          fetchStats();
          fetchBlocked();
          if (activeTab === 'logs') fetchConnections();
          // If no reason was provided, show the post-block reason modal
          if (!reason) {
            setPostBlockFp(fpToPrompt);
            setPostBlockReasonText('');
            setShowPostBlockReason(true);
          }
        } else {
          const data = await r.json().catch(() => ({}));
          alert(data.detail || 'Erro ao bloquear dispositivo');
        }
      } else {
        const r = await fetch(`${API}/api/admin/traffic/block-ip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ ip: blockTargetIp, reason: reason || 'Bloqueio manual' }),
        });
        if (r.ok) {
          setShowBlockModal(false);
          setBlockTargetIp('');
          setBlockTargetFp('');
          setBlockReason('');
          fetchStats();
          fetchBlocked();
          if (activeTab === 'logs') fetchConnections();
        } else {
          const data = await r.json().catch(() => ({}));
          alert(data.detail || 'Erro ao bloquear IP');
        }
      }
    } catch {} finally {
      setActionLoading(false);
    }
  };

  const handleSaveReason = async (fp: string, reason: string, onDone: () => void) => {
    try {
      const authHeaders = await getAuthHeaders();
      const r = await fetch(`${API}/api/admin/traffic/update-device-reason`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ fingerprint_hash: fp, reason }),
      });
      if (r.ok) {
        fetchBlocked();
        onDone();
      }
    } catch {}
  };

  const handleUnblock = async (ip: string) => {
    if (!confirm(`Desbloquear o IP ${ip}?`)) return;
    try {
      const authHeaders = await getAuthHeaders();
      await fetch(`${API}/api/admin/traffic/unblock-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ ip }),
      });
      fetchStats();
      fetchBlocked();
    } catch {}
  };

  const handleUnblockDevice = async (fpHash: string) => {
    if (!confirm(`Desbloquear este dispositivo e todos os IPs associados?`)) return;
    try {
      const authHeaders = await getAuthHeaders();
      await fetch(`${API}/api/admin/traffic/unblock-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ fingerprint_hash: fpHash }),
      });
      fetchStats();
      fetchBlocked();
      if (activeTab === 'logs') fetchConnections();
    } catch {}
  };

  const openBlockModal = (ip: string, fpHash: string = '') => {
    setBlockTargetIp(ip);
    setBlockTargetFp(fpHash);
    setBlockReason('');
    setShowBlockModal(true);
  };

  const downloadSnapshot = (snapshot: string, ip: string) => {
    const blob = new Blob([snapshot || 'Sem dados de logs disponíveis'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blocked_${ip.replace(/\./g, '_')}_logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── HELPERS ─────────────────────────────────────────

  const formatTime = (dt: string) => {
    try {
      return new Date(dt).toLocaleString('pt-PT', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch { return dt; }
  };

  const getMethodClass = (m: string) => {
    switch (m) {
      case 'GET': return 'method-get';
      case 'POST': return 'method-post';
      case 'PUT': case 'PATCH': return 'method-put';
      case 'DELETE': return 'method-delete';
      case 'PAGE': return 'method-page';
      default: return '';
    }
  };

  const getSeverityClass = (s: string) => {
    switch (s) {
      case 'low': return 'severity-low';
      case 'medium': return 'severity-medium';
      case 'high': return 'severity-high';
      case 'critical': return 'severity-critical';
      default: return '';
    }
  };

  const getEventLabel = (e: string) => {
    const labels: Record<string, string> = {
      rate_limit: 'Rate Limit',
      scanner: 'Scanner',
      sql_injection: 'SQL Injection',
      path_traversal: 'Path Traversal',
      brute_force: 'Brute Force',
      recon_probe: 'Recon Probe',
      suspicious_ua: 'User-Agent Suspeito',
    };
    return labels[e] || e;
  };

  const getEventIcon = (e: string) => {
    const icons: Record<string, string> = {
      rate_limit: 'fa-gauge-high',
      scanner: 'fa-radar',
      sql_injection: 'fa-database',
      path_traversal: 'fa-folder-tree',
      brute_force: 'fa-key',
      recon_probe: 'fa-binoculars',
      suspicious_ua: 'fa-user-secret',
    };
    return icons[e] || 'fa-triangle-exclamation';
  };

  // ─── WIRESHARK-STYLE HELPERS ─────────────────────

  const formatTimeWS = (dt: string) => {
    try {
      return new Date(dt).toLocaleTimeString('pt-PT', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch { return dt; }
  };

  const getStatusClass = (code: number) => {
    if (code >= 500) return 'status-5xx';
    if (code >= 400) return 'status-4xx';
    if (code >= 300) return 'status-3xx';
    return 'status-2xx';
  };

  const getDetailedRowClass = (entry: DetailedLogEntry) => {
    if (entry._type === 'threat') {
      switch (entry.severity) {
        case 'critical': return 'ws-row ws-threat ws-critical';
        case 'high': return 'ws-row ws-threat ws-high';
        case 'medium': return 'ws-row ws-threat ws-medium';
        case 'low': return 'ws-row ws-threat ws-low';
        default: return 'ws-row ws-threat';
      }
    }
    if (entry.method === 'PAGE') return 'ws-row ws-page';
    return 'ws-row ws-request';
  };

  const getTypeIcon = (entry: DetailedLogEntry) => {
    if (entry._type === 'threat') return getEventIcon(entry.event || '');
    if (entry.method === 'PAGE') return 'fa-eye';
    return 'fa-arrow-right-arrow-left';
  };

  const getTypeLabel = (entry: DetailedLogEntry) => {
    if (entry._type === 'threat') return 'Ameaça';
    if (entry.method === 'PAGE') return 'Visita';
    return 'Request';
  };

  // Set of blocked IPs and fingerprints for quick lookup in logs tab
  const blockedIpSet = new Set([
    ...blocked.map(b => b.ip),
    ...blockedDevices.flatMap(d => d.associated_ips || []),
  ]);
  const blockedFpSet = new Set(blockedDevices.map(d => d.fingerprint_hash));
  // Set of admin fingerprints AND IPs (from connections data)
  const adminFpSet = new Set(connections.filter(c => c.is_admin).map(c => c.fingerprint_hash));
  const adminIpSet = new Set(connections.filter(c => c.is_admin).flatMap(c => c.ips));

  // Standalone blocked IPs (not associated with any blocked device)
  const deviceAssociatedIps = new Set(blockedDevices.flatMap(d => d.associated_ips || []));
  const standaloneBlockedIps = blocked.filter(b => !deviceAssociatedIps.has(b.ip));
  const adjustedBlockedTotal = blockedDevices.length + standaloneBlockedIps.length;

  // Admin threat IPs to subtract from suspicious count
  const adminThreatIps = new Set(
    detailedLogs
      .filter(e => e._type === 'threat' && adminIpSet.has(e.ip))
      .map(e => e.ip)
  );
  const adjustedSuspiciousToday = Math.max(0, (stats?.suspicious_today || 0) - adminThreatIps.size);

  // Filtered detailed logs (client-side filtering for instant UX)
  const filteredDetailedLogs = detailedLogs.filter(entry => {
    if (detailedFilter && !entry.ip.includes(detailedFilter)) return false;
    if (detailedTypeFilter === 'request' && (entry._type !== 'request' || entry.method === 'PAGE')) return false;
    if (detailedTypeFilter === 'visit' && !(entry._type === 'request' && entry.method === 'PAGE')) return false;
    if (detailedTypeFilter === 'threat' && entry._type !== 'threat') return false;
    // Task 9: Hide admin IPs from threats view when admin is logged in
    if (entry._type === 'threat' && adminIpSet.has(entry.ip)) return false;
    return true;
  });

  // ─── RENDER ──────────────────────────────────────────

  return (
    <div className="traffic-container">
      {/* ═══ HEADER ═══ */}
      <div className="traffic-header">
        <button className="back-btn" onClick={() => router.push('/admin')}>
          <i className="fa-solid fa-arrow-left"></i>
          Voltar
        </button>
        <h1>
          <i className="fa-solid fa-shield-halved"></i>
          Monitor de Tráfego
        </h1>
        <div className="header-actions">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-refresh</span>
          </label>
          {autoRefresh && (
            <span className="live-indicator">
              <span className="live-dot"></span>
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* ═══ STATS ═══ */}
      {stats && (
        <div className="traffic-stats">
          <div className="stat-card">
            <div className="stat-icon"><i className="fa-solid fa-chart-line"></i></div>
            <div className="stat-info">
              <div className="stat-value">{stats.requests_today.toLocaleString()}</div>
              <div className="stat-label">Requests (hoje)</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><i className="fa-solid fa-users"></i></div>
            <div className="stat-info">
              <div className="stat-value">{connections.filter(c => c.online).length}</div>
              <div className="stat-label">IPs Online</div>
            </div>
          </div>
          <div className="stat-card stat-warning">
            <div className="stat-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
            <div className="stat-info">
              <div className="stat-value">{adjustedSuspiciousToday}</div>
              <div className="stat-label">Suspeitos</div>
            </div>
          </div>
          <div className="stat-card stat-danger">
            <div className="stat-icon"><i className="fa-solid fa-ban"></i></div>
            <div className="stat-info">
              <div className="stat-value">{adjustedBlockedTotal}</div>
              <div className="stat-label">Bloqueados</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TABS ═══ */}
      <div className="traffic-tabs">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <i className="fa-solid fa-chart-area"></i>
          <span>Dashboard</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <i className="fa-solid fa-list"></i>
          <span>Logs</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'detailed' ? 'active' : ''}`}
          onClick={() => setActiveTab('detailed')}
        >
          <i className="fa-solid fa-tower-broadcast"></i>
          <span>Logs Detalhados</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'blocked' ? 'active' : ''}`}
          onClick={() => setActiveTab('blocked')}
        >
          <i className="fa-solid fa-ban"></i>
          <span>Bloqueados</span>
        </button>
      </div>

      {/* ═══ ERROR ═══ */}
      {error && (
        <div className="traffic-error">
          <i className="fa-solid fa-circle-exclamation"></i>
          <span>{error}</span>
        </div>
      )}

      {/* ═══ LOADING ═══ */}
      {isLoading && (
        <div className="traffic-loading">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <span>A carregar dados...</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB 0: DASHBOARD (Graficos e Estatisticas)     */}
      {/* ═══════════════════════════════════════════════ */}
      {!isLoading && activeTab === 'dashboard' && (
        <div className="dashboard-content">
          {chartLoading && !chartData ? (
            <div className="traffic-loading">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <span>A carregar dashboard...</span>
            </div>
          ) : chartData ? (
            <>
              {/* -- Summary Cards -- */}
              <div className="dash-summary">
                <div className="dash-summary-card">
                  <div className="dash-summary-icon"><i className="fa-solid fa-globe"></i></div>
                  <div className="dash-summary-value">{chartData.unique_ips_today}</div>
                  <div className="dash-summary-label">IPs Unicos</div>
                </div>
                <div className="dash-summary-card">
                  <div className="dash-summary-icon"><i className="fa-solid fa-arrow-right-arrow-left"></i></div>
                  <div className="dash-summary-value">{chartData.total_requests_today.toLocaleString()}</div>
                  <div className="dash-summary-label">Total Requests</div>
                </div>
                <div className="dash-summary-card dash-card-warn">
                  <div className="dash-summary-icon"><i className="fa-solid fa-skull-crossbones"></i></div>
                  <div className="dash-summary-value">{chartData.total_threats_today}</div>
                  <div className="dash-summary-label">Ameacas</div>
                </div>
                <div className="dash-summary-card dash-card-danger">
                  <div className="dash-summary-icon"><i className="fa-solid fa-shield-halved"></i></div>
                  <div className="dash-summary-value">{chartData.recent_blocks}</div>
                  <div className="dash-summary-label">Bloqueios Recentes</div>
                </div>
              </div>

              {/* -- Row 1: Requests por Hora + Ameacas por Hora -- */}
              <div className="dash-charts-row">
                <div className="dash-chart-card dash-chart-wide">
                  <h3 className="dash-chart-title">
                    <i className="fa-solid fa-chart-area"></i>
                    Requests por Hora (Hoje)
                  </h3>
                  <div className="dash-chart-body">
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={chartData.hourly_requests}>
                        <defs>
                          <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ff0000" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ff0000" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="hour" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                        <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, color: '#fff' }}
                          labelStyle={{ color: '#ff0000' }}
                        />
                        <Area type="monotone" dataKey="requests" stroke="#ff0000" fill="url(#gradReq)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="dash-chart-card dash-chart-wide">
                  <h3 className="dash-chart-title">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    Ameacas por Hora (Hoje)
                  </h3>
                  <div className="dash-chart-body">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData.hourly_threats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="hour" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                        <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, color: '#fff' }}
                          labelStyle={{ color: '#ff4444' }}
                        />
                        <Bar dataKey="threats" fill="#ff4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* -- Row 2: Tipos de Ameaca + Top Paises -- */}
              <div className="dash-charts-row">
                <div className="dash-chart-card">
                  <h3 className="dash-chart-title">
                    <i className="fa-solid fa-crosshairs"></i>
                    Tipos de Ameaca
                  </h3>
                  <div className="dash-chart-body">
                    {chartData.threat_distribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={chartData.threat_distribution.map(t => ({
                              ...t,
                              name: THREAT_LABELS[t.type] || t.type,
                            }))}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="count"
                            nameKey="name"
                            label={({ name, percent }: { name: string; percent?: number }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {chartData.threat_distribution.map((t, i) => (
                              <Cell key={t.type} fill={THREAT_COLORS[t.type] || CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, color: '#fff' }}
                          />
                          <Legend
                            wrapperStyle={{ color: '#888', fontSize: 12 }}
                            formatter={(value: string) => <span style={{ color: '#ccc' }}>{value}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="dash-empty">Sem ameacas registadas hoje</div>
                    )}
                  </div>
                </div>

                <div className="dash-chart-card">
                  <h3 className="dash-chart-title">
                    <i className="fa-solid fa-earth-americas"></i>
                    Top Paises
                  </h3>
                  <div className="dash-chart-body">
                    {chartData.top_countries.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData.top_countries} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis type="number" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                          <YAxis dataKey="country" type="category" width={90} stroke="#666" tick={{ fill: '#ccc', fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, color: '#fff' }}
                          />
                          <Bar dataKey="requests" fill="#ff0000" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="dash-empty">Sem dados de paises</div>
                    )}
                  </div>
                </div>
              </div>

              {/* -- Row 3: VPN vs Direto + Metodos HTTP -- */}
              <div className="dash-charts-row">
                <div className="dash-chart-card">
                  <h3 className="dash-chart-title">
                    <i className="fa-solid fa-mask"></i>
                    VPN vs Direto
                  </h3>
                  <div className="dash-chart-body">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'VPN', value: chartData.vpn_stats.vpn },
                            { name: 'Direto', value: chartData.vpn_stats.direct },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="#ff4444" />
                          <Cell fill="#444" />
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, color: '#fff' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 12 }}
                          formatter={(value: string) => <span style={{ color: '#ccc' }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="dash-chart-card">
                  <h3 className="dash-chart-title">
                    <i className="fa-solid fa-code"></i>
                    Metodos HTTP
                  </h3>
                  <div className="dash-chart-body">
                    {chartData.methods.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={chartData.methods}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="method" stroke="#666" tick={{ fill: '#ccc', fontSize: 12 }} />
                          <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, color: '#fff' }}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {chartData.methods.map((m, i) => (
                              <Cell key={m.method} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="dash-empty">Sem dados de metodos</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="dash-empty">Sem dados disponiveis para o dashboard</div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB 1: LOGS (Conexões únicas hoje)              */}
      {/* ═══════════════════════════════════════════════ */}
      {!isLoading && activeTab === 'logs' && (
        <div className="traffic-table-wrapper">
          <div className="connections-header">
            <span className="connections-date">
              <i className="fa-regular fa-calendar"></i>
              {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                .replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            <span className="connections-count">
              {connections.length} conexão{connections.length !== 1 ? 'ões' : ''}
              {' · '}
              <span className="online-count">{connections.filter(c => c.online).length} online</span>
            </span>
          </div>
          {connections.length === 0 ? (
            <div className="empty-state">
              <i className="fa-solid fa-plug-circle-xmark"></i>
              <p>Sem conexões registadas hoje</p>
              <span className="empty-hint">As conexões aparecem quando alguém visita o site</span>
            </div>
          ) : (
            <table className="traffic-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Dispositivo</th>
                  <th>IPs</th>
                  <th>Localização</th>
                  <th>Tipo</th>
                  <th>VPN</th>
                  <th>Requests</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((conn, idx) => {
                  const isBlockedConn = blockedFpSet.has(conn.fingerprint_hash) || conn.ips.some(ip => blockedIpSet.has(ip));
                  return (
                    <tr
                      key={conn.fingerprint_hash || conn.ips[0] || idx}
                      className={
                        isBlockedConn ? 'row-blocked' :
                        conn.is_admin ? 'row-admin' :
                        conn.is_vpn ? 'row-vpn' :
                        conn.online ? 'row-online' : ''
                      }
                    >
                      <td>
                        <span className={`online-badge ${conn.online ? 'is-online' : 'is-offline'}`}>
                          <span className="online-dot"></span>
                          {conn.online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="col-device">
                        {conn.fingerprint_hash ? (
                          <span className="device-badge" title={conn.fingerprint_hash}>
                            <i className="fa-solid fa-fingerprint"></i>
                            {conn.fingerprint_hash.slice(0, 10)}…
                          </span>
                        ) : (
                          <span className="no-fp">—</span>
                        )}
                      </td>
                      <td className="col-ips">
                        <span
                          className={`ip-tag ip-clickable${conn.ips.length > 1 ? ' ip-has-more' : ''}`}
                          onClick={() => { if (conn.ip_details?.length > 0) { setIpModalData({ ip_details: conn.ip_details }); setShowIpModal(true); } }}
                          title={conn.ips.length > 1 ? `${conn.ips.length} IPs — clique para ver todos` : conn.ips[0]}
                        >
                          <code>{conn.ips[0]}</code>
                          {conn.ips.length > 1 && <span className="ip-more-badge">+{conn.ips.length - 1}</span>}
                        </span>
                      </td>
                      <td className="col-location">
                        {conn.country || '—'}
                        {conn.city ? `, ${conn.city}` : ''}
                      </td>
                      <td>
                        <span className={`method-badge ${getMethodClass(conn.method)}`}>
                          {conn.method}
                        </span>
                      </td>
                      <td>
                        {conn.is_vpn ? (
                          <span className="vpn-badge" title={conn.vpn_provider || 'VPN/Proxy detetado'}>
                            Sim
                          </span>
                        ) : (
                          <span className="no-vpn">Não</span>
                        )}
                      </td>
                      <td className="col-requests">
                        <span className="requests-count">{conn.requests}</span>
                      </td>
                      <td className="col-actions">
                        {!isBlockedConn && !conn.is_admin && conn.ips[0] !== '127.0.0.1' && (
                          <button
                            className="action-btn block-btn"
                            onClick={() => openBlockModal(conn.ips[0], conn.fingerprint_hash)}
                            title={conn.fingerprint_hash ? 'Bloquear dispositivo' : 'Bloquear IP'}
                          >
                            <i className={`fa-solid ${conn.fingerprint_hash ? 'fa-fingerprint' : 'fa-ban'}`}></i>
                          </button>
                        )}
                        {conn.is_admin && (
                          <span className="admin-fp-icon" title="Admin">
                            <i className="fa-solid fa-fingerprint"></i>
                          </span>
                        )}
                        {isBlockedConn && (
                          <span className="already-blocked" title="Bloqueado">
                            <i className="fa-solid fa-lock"></i>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB 2: LOGS DETALHADOS (Wireshark-style)       */}
      {/* ═══════════════════════════════════════════════ */}
      {!isLoading && activeTab === 'detailed' && (
        <div className="traffic-table-wrapper detailed-wrapper">
          {/* ─── Filter Toolbar ─── */}
          <div className="detailed-toolbar">
            <div className="detailed-search">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                type="text"
                placeholder="Filtrar por IP..."
                value={detailedFilter}
                onChange={(e) => setDetailedFilter(e.target.value)}
              />
            </div>
            <div className="detailed-type-filters">
              <button
                className={`type-filter-btn ${detailedTypeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDetailedTypeFilter('all')}
              >
                Todos
              </button>
              <button
                className={`type-filter-btn ${detailedTypeFilter === 'visit' ? 'active' : ''}`}
                onClick={() => setDetailedTypeFilter('visit')}
              >
                <i className="fa-solid fa-eye"></i> Visitas
              </button>
              <button
                className={`type-filter-btn ${detailedTypeFilter === 'request' ? 'active' : ''}`}
                onClick={() => setDetailedTypeFilter('request')}
              >
                <i className="fa-solid fa-arrow-right-arrow-left"></i> Requests
              </button>
              <button
                className={`type-filter-btn ${detailedTypeFilter === 'threat' ? 'active' : ''}`}
                onClick={() => setDetailedTypeFilter('threat')}
              >
                <i className="fa-solid fa-skull-crossbones"></i> Ameaças
              </button>
            </div>
            <span className="detailed-count">
              {filteredDetailedLogs.length} entrada{filteredDetailedLogs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filteredDetailedLogs.length === 0 ? (
            <div className="empty-state">
              <i className="fa-solid fa-satellite-dish"></i>
              <p>Sem atividade registada</p>
              <span className="empty-hint">Os logs aparecem em tempo real quando há tráfego</span>
            </div>
          ) : (
            <table className="traffic-table wireshark-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>IP</th>
                  <th>Método</th>
                  <th>Caminho</th>
                  <th>Estado</th>
                  <th>Localização</th>
                  <th>Informação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetailedLogs.map((entry) => (
                  <tr key={entry.id} className={getDetailedRowClass(entry)}>
                    <td className="col-time-ws">{formatTimeWS(entry.timestamp)}</td>
                    <td>
                      <span className={`type-badge type-${entry._type === 'threat' ? 'threat' : entry.method === 'PAGE' ? 'page' : 'request'}`}>
                        {getTypeLabel(entry)}
                      </span>
                    </td>
                    <td className="col-ip"><code>{entry.ip}</code></td>
                    <td>
                      {entry._type === 'threat' ? (
                        <span className={`event-badge event-${entry.event}`}>
                          {getEventLabel(entry.event || '')}
                        </span>
                      ) : (
                        <span className={`method-badge ${getMethodClass(entry.method)}`}>
                          {entry.method}
                        </span>
                      )}
                    </td>
                    <td className="col-path" title={entry.path}>{entry.path}</td>
                    <td>
                      {entry._type === 'threat' ? (
                        <span className={`severity-badge ${getSeverityClass(entry.severity || '')}`}>
                          {(entry.severity || '').toUpperCase()}
                        </span>
                      ) : (
                        <span className={`status-badge ${getStatusClass(entry.status_code)}`}>
                          {entry.status_code}
                        </span>
                      )}
                    </td>
                    <td className="col-location">
                      {entry.country || '—'}
                      {entry.city ? `, ${entry.city}` : ''}
                    </td>
                    <td className="col-info">
                      {entry._type === 'threat' ? (
                        <div className="threat-info">
                          <span className="threat-detail">{entry.details}</span>
                          {entry.auto_blocked && (
                            <span className="auto-blocked-badge">
                              <i className="fa-solid fa-robot"></i>
                              Auto-bloqueado
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="request-info">
                          {entry.response_time_ms > 0 && (
                            <span className="response-time">{entry.response_time_ms}ms</span>
                          )}
                          {entry.is_vpn && (
                            <span className="vpn-badge small">VPN</span>
                          )}
                          {entry.method === 'PAGE' && !entry.is_vpn && (
                            <span className="info-label-page">
                              <i className="fa-solid fa-eye"></i> Visita de página
                            </span>
                          )}
                          {entry.method !== 'PAGE' && entry.response_time_ms === 0 && !entry.is_vpn && (
                            <span className="info-label-api">
                              <i className="fa-solid fa-server"></i> API call
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="col-actions">
                      {(() => {
                        const fp = entry.fingerprint_hash || '';
                        const isAdmin = (fp && adminFpSet.has(fp)) || adminIpSet.has(entry.ip);
                        const isBlocked = (fp && blockedFpSet.has(fp)) || blockedIpSet.has(entry.ip);
                        const isAutoBlocked = entry._type === 'threat' && entry.auto_blocked;
                        if (isAdmin) return (
                          <span className="admin-fp-icon" title="Administrador">
                            <i className="fa-solid fa-shield-halved"></i>
                          </span>
                        );
                        if (isBlocked || isAutoBlocked) return null;
                        // Build reason based on entry type
                        const reason = entry._type === 'threat'
                          ? `[Ameaça] ${getEventLabel(entry.event || '')}: ${entry.details || ''}`
                          : '';
                        return (
                          <button
                            className="action-btn block-btn threat-block-btn"
                            onClick={() => {
                              setBlockTargetIp(entry.ip);
                              setBlockTargetFp(fp);
                              setBlockReason(reason);
                              setShowBlockModal(true);
                            }}
                            title={fp ? 'Bloquear dispositivo' : 'Bloquear IP'}
                          >
                            <i className={`fa-solid ${fp ? 'fa-fingerprint' : 'fa-ban'}`}></i>
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB 3: BLOQUEADOS (Dispositivos + IPs)         */}
      {/* ═══════════════════════════════════════════════ */}
      {!isLoading && activeTab === 'blocked' && (
        <div className="traffic-table-wrapper">
          {/* ─── Dispositivos Bloqueados ─── */}
          {blockedDevices.length > 0 && (
            <>
              <div className="blocked-section-header">
                <span>Dispositivos Bloqueados</span>
              </div>
              <table className="traffic-table">
                <thead>
                  <tr>
                    <th>Dispositivo</th>
                    <th>IPs Associados</th>
                    <th>Motivo</th>
                    <th>Bloqueado por</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {blockedDevices.map((d) => {
                    const isAuto = d.blocked_by === 'system';
                    const parsed = isAuto ? parseAutoReason(d.reason) : null;
                    const hasReason = d.reason && d.reason.trim().length > 0;
                    const ips = d.associated_ips || [];
                    return (
                      <tr key={d.id}>
                        <td className="col-device">
                          <span className="device-badge" title={d.fingerprint_hash}>
                            <i className="fa-solid fa-fingerprint"></i>
                            {d.fingerprint_hash.slice(0, 12)}…
                          </span>
                        </td>
                        <td className="col-ips">
                          {ips.length > 0 ? (
                            <span
                              className={`ip-tag ip-clickable${ips.length > 1 ? ' ip-has-more' : ''}`}
                              onClick={() => { setIpModalData({ ip_details: d.ip_details && d.ip_details.length > 0 ? d.ip_details : ips.map(ip => ({ ip, is_vpn: false })) }); setShowIpModal(true); }}
                              title={ips.length > 1 ? `${ips.length} IPs — clique para ver todos` : ips[0]}
                            >
                              <code>{ips[0]}</code>
                              {ips.length > 1 && <span className="ip-more-badge">+{ips.length - 1}</span>}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="col-reason">
                          {isAuto && parsed && hasReason ? (
                            <span
                              className="reason-clickable"
                              onClick={() => { setReasonModalData(parsed); setShowReasonModal(true); }}
                              title="Clique para ver detalhes"
                            >
                              {parsed.simple}
                            </span>
                          ) : hasReason ? (
                            d.reason
                          ) : (
                            <span
                              className="reason-empty-clickable"
                              onClick={() => { setEditReasonFp(d.fingerprint_hash); setEditReasonText(''); setShowEditReason(true); }}
                              title="Clique para adicionar um motivo"
                            >
                              Sem motivo adicionado ainda.
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="blocker-badge-plain">
                            {isAuto ? 'Sis. Auto.' : 'Bloq. Manual'}
                          </span>
                        </td>
                        <td className="col-time">{formatTime(d.created_at)}</td>
                        <td className="col-actions">
                          <button
                            className="action-btn unblock-btn"
                            onClick={() => handleUnblockDevice(d.fingerprint_hash)}
                            title="Desbloquear dispositivo + todos os IPs"
                          >
                            <i className="fa-solid fa-unlock"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* ─── Standalone Blocked IPs (not associated with any device) ─── */}
          {standaloneBlockedIps.length > 0 && (
            <>
              <div className="blocked-section-header" style={{ marginTop: blockedDevices.length > 0 ? '24px' : '0' }}>
                <span>IPs Bloqueados (sem dispositivo associado)</span>
              </div>
              <table className="traffic-table">
                <thead>
                  <tr>
                    <th>IP</th>
                    <th>País</th>
                    <th>Motivo</th>
                    <th>Bloqueado por</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {standaloneBlockedIps.map((b) => (
                    <tr key={b.id}>
                      <td><code className="ip-tag">{b.ip}</code></td>
                      <td>{b.country || '—'}</td>
                      <td className="col-reason">{b.reason || 'Sem motivo'}</td>
                      <td>
                        <span className="blocker-badge-plain">
                          {b.blocked_by === 'system' ? 'Sis. Auto.' : 'Bloq. Manual'}
                        </span>
                      </td>
                      <td className="col-time">{formatTime(b.created_at)}</td>
                      <td className="col-actions">
                        <button
                          className="action-btn unblock-btn"
                          onClick={() => handleUnblock(b.ip)}
                          title="Desbloquear IP"
                        >
                          <i className="fa-solid fa-unlock"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {blockedDevices.length === 0 && standaloneBlockedIps.length === 0 && (
            <div className="empty-state">
              <i className="fa-solid fa-unlock"></i>
              <p>Nenhum dispositivo ou IP bloqueado</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ BLOCK MODAL ═══ */}
      {showBlockModal && (
        <div className="modal-overlay" onClick={() => setShowBlockModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className={`fa-solid ${blockTargetFp ? 'fa-fingerprint' : 'fa-ban'}`}></i>
              {blockTargetFp ? 'Bloquear Dispositivo' : 'Bloquear IP'}
            </h3>
            {!blockTargetFp && (
              <p className="modal-ip">{blockTargetIp}</p>
            )}
            <div className="modal-field">
              <label>Motivo do bloqueio (opcional)</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ex: Atividade suspeita, tentativas de brute force..."
                rows={3}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowBlockModal(false)}>
                Cancelar
              </button>
              <button
                className="modal-confirm"
                onClick={handleBlock}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <i className={`fa-solid ${blockTargetFp ? 'fa-fingerprint' : 'fa-ban'}`}></i>
                )}
                Bloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ REASON DETAIL MODAL ═══ */}
      {showReasonModal && (
        <div className="modal-overlay" onClick={() => setShowReasonModal(false)}>
          <div className="modal-content reason-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fa-solid fa-circle-info"></i>
              Detalhes do Bloqueio
            </h3>
            <div className="reason-modal-body">
              <div className="reason-field">
                <label>Razão</label>
                <p>{reasonModalData.simple}</p>
              </div>
              <div className="reason-field">
                <label>Detalhes</label>
                <p className="reason-detail-text">{reasonModalData.detail}</p>
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowReasonModal(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ IP DETAILS MODAL ═══ */}
      {showIpModal && (
        <div className="modal-overlay" onClick={() => setShowIpModal(false)}>
          <div className="modal-content ip-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fa-solid fa-network-wired"></i>
              IPs do Dispositivo
            </h3>
            <div className="ip-modal-body">
              {ipModalData.ip_details.length > 0 && (
                <>
                  <div className="ip-modal-current">
                    <div className="ip-modal-section-header">
                      <label>IP Atual</label>
                      <label>VPN</label>
                    </div>
                    <div className="ip-modal-row">
                      <code>{ipModalData.ip_details[0].ip}</code>
                      <span className={`vpn-indicator ${ipModalData.ip_details[0].is_vpn ? 'is-vpn' : 'no-vpn'}`}>
                        {ipModalData.ip_details[0].is_vpn ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  </div>
                  {ipModalData.ip_details.length > 1 && (
                    <div className="ip-modal-history">
                      <label>IPs que foram usados</label>
                      {ipModalData.ip_details.slice(1).map((d) => (
                        <div key={d.ip} className="ip-modal-row">
                          <code>{d.ip}</code>
                          <span className={`vpn-indicator ${d.is_vpn ? 'is-vpn' : 'no-vpn'}`}>
                            {d.is_vpn ? 'Sim' : 'Não'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowIpModal(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ POST-BLOCK REASON MODAL ═══ */}
      {showPostBlockReason && (
        <div className="modal-overlay" onClick={() => setShowPostBlockReason(false)}>
          <div className="modal-content reason-prompt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fa-solid fa-pen"></i>
              Adicionar Motivo
            </h3>
            <p className="reason-prompt-text">O dispositivo foi bloqueado. Quer adicionar um motivo?</p>
            <div className="modal-field">
              <textarea
                value={postBlockReasonText}
                onChange={(e) => setPostBlockReasonText(e.target.value)}
                placeholder="Ex: Atividade suspeita..."
                rows={3}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowPostBlockReason(false)}>
                Cancelar
              </button>
              <button
                className="modal-confirm modal-confirm-save"
                disabled={!postBlockReasonText.trim() || postBlockSaving}
                onClick={async () => {
                  setPostBlockSaving(true);
                  await handleSaveReason(postBlockFp, postBlockReasonText.trim(), () => setShowPostBlockReason(false));
                  setPostBlockSaving(false);
                }}
              >
                {postBlockSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT REASON MODAL (from blocked tab) ═══ */}
      {showEditReason && (
        <div className="modal-overlay" onClick={() => setShowEditReason(false)}>
          <div className="modal-content reason-prompt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fa-solid fa-pen"></i>
              Adicionar Motivo
            </h3>
            <div className="modal-field">
              <label>Motivo do bloqueio</label>
              <textarea
                value={editReasonText}
                onChange={(e) => setEditReasonText(e.target.value)}
                placeholder="Ex: Atividade suspeita..."
                rows={3}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowEditReason(false)}>
                Cancelar
              </button>
              <button
                className="modal-confirm modal-confirm-save"
                disabled={!editReasonText.trim() || editReasonSaving}
                onClick={async () => {
                  setEditReasonSaving(true);
                  await handleSaveReason(editReasonFp, editReasonText.trim(), () => setShowEditReason(false));
                  setEditReasonSaving(false);
                }}
              >
                {editReasonSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
