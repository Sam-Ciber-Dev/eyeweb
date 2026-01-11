/**
 * Eye Web - Serviço de API
 * Comunicação com o backend FastAPI
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface BreachInfo {
  name: string;
  date: string;
  data_classes: string[];
}

export interface BreachCandidate {
  hash: string;
  breach_name: string;
  breach_date: string;
  data_classes: string[];
}

export interface BreachCheckResponse {
  prefix: string;
  count: number;
  candidates: BreachCandidate[];
}

export interface ApiStats {
  status: string;
  dataset_repo: string;
  total_partitions: number;
  cached_partitions: number;
  cache_ttl_seconds: number;
}

/**
 * Calcula o hash SHA-256 de uma string
 * Usa a Web Crypto API (disponível no browser)
 */
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Verifica se um email foi exposto em fugas de dados
 * Implementa K-Anonymity: apenas o prefixo do hash é enviado
 */
export async function checkEmailBreach(email: string): Promise<{
  found: boolean;
  breaches: BreachInfo[];
  fullHash: string;
}> {
  // 1. Calcular hash SHA-256 localmente
  const fullHash = await sha256(email);
  const prefix = fullHash.substring(0, 5);
  
  // 2. Enviar apenas o prefixo para a API (K-Anonymity)
  const response = await fetch(`${API_BASE_URL}/api/v1/breaches/check/${prefix}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  const data: BreachCheckResponse = await response.json();
  
  // 3. Verificar localmente se o hash completo está na lista (K-Anonymity)
  // O backend retorna todos os hashes que começam com o prefixo
  // Comparamos localmente para manter a privacidade
  const matchedBreaches: BreachInfo[] = [];
  
  for (const candidate of data.candidates) {
    if (candidate.hash === fullHash) {
      matchedBreaches.push({
        name: candidate.breach_name,
        date: candidate.breach_date,
        data_classes: candidate.data_classes,
      });
    }
  }
  
  return {
    found: matchedBreaches.length > 0,
    breaches: matchedBreaches,
    fullHash,
  };
}

/**
 * Verifica a força de uma password (verificação local)
 * Não envia para nenhum servidor
 */
export function checkPasswordStrength(password: string): {
  score: number;
  feedback: string[];
  level: 'weak' | 'medium' | 'strong' | 'very-strong';
} {
  const feedback: string[] = [];
  let score = 0;
  
  // Comprimento
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (password.length < 8) feedback.push('Usa pelo menos 8 caracteres');
  
  // Letras minúsculas
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Adiciona letras minúsculas');
  
  // Letras maiúsculas
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Adiciona letras maiúsculas');
  
  // Números
  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('Adiciona números');
  
  // Caracteres especiais
  if (/[^A-Za-z0-9]/.test(password)) score += 2;
  else feedback.push('Adiciona caracteres especiais (!@#$%...)');
  
  // Padrões comuns (penalização)
  const commonPatterns = [
    /^123/, /abc/i, /qwerty/i, /password/i, /admin/i,
    /(.)\1{2,}/, // 3+ caracteres repetidos
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score -= 1;
      feedback.push('Evita padrões comuns');
      break;
    }
  }
  
  // Determinar nível
  let level: 'weak' | 'medium' | 'strong' | 'very-strong';
  if (score <= 3) level = 'weak';
  else if (score <= 5) level = 'medium';
  else if (score <= 7) level = 'strong';
  else level = 'very-strong';
  
  return { score: Math.max(0, Math.min(10, score)), feedback, level };
}

/**
 * Verifica se um URL parece suspeito (verificação básica local)
 */
export function checkUrlSecurity(url: string): {
  safe: boolean;
  warnings: string[];
  details: { https: boolean; suspiciousTLD: boolean; ipAddress: boolean };
} {
  const warnings: string[] = [];
  
  let parsedUrl: URL;
  try {
    // Adicionar protocolo se não existir
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    parsedUrl = new URL(url);
  } catch {
    return {
      safe: false,
      warnings: ['URL inválido'],
      details: { https: false, suspiciousTLD: false, ipAddress: false },
    };
  }
  
  // Verificar HTTPS
  const https = parsedUrl.protocol === 'https:';
  if (!https) {
    warnings.push('Site não usa HTTPS (conexão não encriptada)');
  }
  
  // Verificar TLDs suspeitos
  const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click', '.link'];
  const suspiciousTLD = suspiciousTLDs.some(tld => parsedUrl.hostname.endsWith(tld));
  if (suspiciousTLD) {
    warnings.push('TLD frequentemente usado em phishing');
  }
  
  // Verificar se é IP direto
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipAddress = ipPattern.test(parsedUrl.hostname);
  if (ipAddress) {
    warnings.push('URL usa endereço IP direto (suspeito)');
  }
  
  // Verificar caracteres suspeitos no domínio
  if (/[^\w\-.]/.test(parsedUrl.hostname)) {
    warnings.push('Domínio contém caracteres incomuns');
  }
  
  // Verificar subdomínios excessivos
  const subdomains = parsedUrl.hostname.split('.').length - 2;
  if (subdomains > 3) {
    warnings.push('Muitos subdomínios (possível tentativa de engano)');
  }
  
  return {
    safe: warnings.length === 0,
    warnings,
    details: { https, suspiciousTLD, ipAddress },
  };
}

/**
 * Obtém estatísticas da API
 */
export async function getApiStats(): Promise<ApiStats> {
  const response = await fetch(`${API_BASE_URL}/api/v1/breaches/stats`);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}
