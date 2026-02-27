'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { checkUrlWithAI, UrlCheckResult } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export default function UrlChecker() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UrlCheckResult | null>(null);
  const { t, lang, setLangLocked } = useLanguage();
  
  // Estados para animação sequencial
  const [showGoogleLoading, setShowGoogleLoading] = useState(false);
  const [showGoogleResult, setShowGoogleResult] = useState(false);
  const [showSslLoading, setShowSslLoading] = useState(false);
  const [showSslResult, setShowSslResult] = useState(false);
  const [showFinalStatus, setShowFinalStatus] = useState(false);
  const [showAiOpinion, setShowAiOpinion] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  
  // Estado para tooltip
  const [showTooltip, setShowTooltip] = useState(false);

  // Refs para tradução da opinião IA ao mudar idioma
  const checkedUrlRef = useRef<string | null>(null);
  const prevLangRef = useRef(lang);
  const typingDoneRef = useRef(false);
  const resultRef = useRef(result);
  resultRef.current = result;

  // Texto da opinião IA a mostrar (com cache por idioma)
  const [aiPtText, setAiPtText] = useState<string | null>(null);
  const [aiEnText, setAiEnText] = useState<string | null>(null);

  // Helper — obter opinião IA no idioma atual
  const getAiOpinion = useCallback((): string | null => {
    const cached = lang === 'pt' ? aiPtText : aiEnText;
    return cached || result?.ai_opinion || null;
  }, [lang, aiPtText, aiEnText, result?.ai_opinion]);

  const sanitizeAndValidateUrl = (raw: string): { valid: boolean; cleaned: string; error?: string } => {
    let input = raw.trim();
    if (!input) return { valid: false, cleaned: '', error: t('url.empty') };
    
    // Bloquear protocolos perigosos
    const dangerousProtocols = /^(javascript|data|vbscript|file|ftp|blob|about|chrome|moz-extension):/i;
    if (dangerousProtocols.test(input)) {
      return { valid: false, cleaned: '', error: t('url.protocolNotAllowed') };
    }
    
    // Corrigir protocolos malformados comuns (ht+ps, htps, htp, etc.)
    const malformedProtocol = /^h[t+]+p[s+]*:\/\//i;
    if (malformedProtocol.test(input) && !input.match(/^https?:\/\//i)) {
      input = input.replace(/^[^/]+\/\//, 'https://');
    }
    
    // Remover esquemas desconhecidos (qualquer coisa que nao seja http/https)
    if (input.includes('://') && !input.match(/^https?:\/\//i)) {
      return { valid: false, cleaned: '', error: t('url.protocolInvalid') };
    }
    
    // Se nao tem protocolo, adicionar https://
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
      input = 'https://' + input;
    }
    
    // Auto-upgrade http para https para dominios conhecidos como seguros
    const safeHttpDomains = ['youtube.com', 'www.youtube.com', 'google.com', 'www.google.com',
      'facebook.com', 'www.facebook.com', 'twitter.com', 'www.twitter.com', 'x.com',
      'instagram.com', 'www.instagram.com', 'linkedin.com', 'www.linkedin.com',
      'github.com', 'www.github.com', 'reddit.com', 'www.reddit.com',
      'wikipedia.org', 'en.wikipedia.org', 'pt.wikipedia.org', 'amazon.com', 'www.amazon.com'];
    try {
      const parsed = new URL(input);
      if (parsed.protocol === 'http:' && safeHttpDomains.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
        input = input.replace(/^http:\/\//i, 'https://');
      }
    } catch {}
    
    // Validar com URL API
    try {
      const parsed = new URL(input);
      // Deve ter hostname valido
      if (!parsed.hostname || parsed.hostname.length < 1) {
        return { valid: false, cleaned: '', error: t('url.noDomain') };
      }
      // Hostname deve ter pelo menos um ponto (dominio.tld) ou ser localhost
      if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
        return { valid: false, cleaned: '', error: t('url.incompleteDomain') };
      }
      // Bloquear IPs privados (127.x, 192.168.x, 10.x, 169.254.x, 0.0.0.0)
      const privateIpRegex = /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|0\.0\.0\.0|localhost)/;
      if (privateIpRegex.test(parsed.hostname)) {
        return { valid: false, cleaned: '', error: t('url.localAddress') };
      }
    } catch {
      return { valid: false, cleaned: '', error: t('url.badFormat') };
    }
    
    // Limitar tamanho
    if (input.length > 2048) {
      return { valid: false, cleaned: '', error: t('url.tooLong') };
    }
    
    return { valid: true, cleaned: input };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) return;
    
    // Validar e sanitizar URL
    const validation = sanitizeAndValidateUrl(url);
    if (!validation.valid) {
      setError(validation.error || t('url.invalid'));
      return;
    }
    
    // Reset estados
    setLoading(true);
    setError(null);
    setResult(null);
    setAiPtText(null);
    setAiEnText(null);
    typingDoneRef.current = false;
    setShowGoogleLoading(false);
    setShowGoogleResult(false);
    setShowSslLoading(false);
    setShowSslResult(false);
    setShowFinalStatus(false);
    setShowAiOpinion(false);
    setDisplayedText('');

    // Bloquear troca de idioma durante análise
    setLangLocked(true);

    try {
      // Iniciar animação do Google
      setShowGoogleLoading(true);
      
      const data = await checkUrlWithAI(validation.cleaned, false, lang);
      setResult(data);
      checkedUrlRef.current = validation.cleaned;

      // Guardar cache no idioma atual
      if (data.ai_opinion) {
        if (lang === 'pt') setAiPtText(data.ai_opinion);
        else setAiEnText(data.ai_opinion);
      }
      
      // Sequência de animações
      setTimeout(() => {
        setShowGoogleLoading(false);
        setShowGoogleResult(true);
      }, 1500);
      
      setTimeout(() => {
        setShowSslLoading(true);
      }, 2000);
      
      setTimeout(() => {
        setShowSslLoading(false);
        setShowSslResult(true);
      }, 3500);
      
      setTimeout(() => {
        setShowFinalStatus(true);
      }, 4000);
      
      setTimeout(() => {
        setShowAiOpinion(true);
      }, 4500);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : t('url.checkError'));
      setShowGoogleLoading(false);
    } finally {
      setLoading(false);
    }
  };

  // Efeito de typing para a opinião da IA
  useEffect(() => {
    const opinion = getAiOpinion();
    if (showAiOpinion && opinion) {
      // Se o typing já terminou antes (troca de idioma), mostrar instantaneamente
      if (typingDoneRef.current) {
        setDisplayedText(opinion);
        return;
      }

      let index = 0;
      const text = opinion;
      setDisplayedText('');
      
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayedText(text.substring(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
          // Desbloquear troca de idioma quando termina de escrever
          typingDoneRef.current = true;
          setLangLocked(false);
        }
      }, 20);
      
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAiOpinion, getAiOpinion]);

  // Re-fetch opinião IA quando o idioma muda (depois do typing terminar)
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;

    // Só re-fetch se já temos resultado e o typing terminou
    if (!typingDoneRef.current || !checkedUrlRef.current || !resultRef.current) return;

    // Verificar se já temos cache neste idioma
    const cached = lang === 'pt' ? aiPtText : aiEnText;
    if (cached) return; // Já temos — o getAiOpinion vai mostrar

    let cancelled = false;
    setLangLocked(true); // Bloquear durante re-fetch
    (async () => {
      try {
        const data = await checkUrlWithAI(checkedUrlRef.current!, false, lang);
        if (!cancelled && data.ai_opinion) {
          if (lang === 'pt') setAiPtText(data.ai_opinion);
          else setAiEnText(data.ai_opinion);
        }
      } catch {
        // Falha silenciosa — mantém opinião no idioma anterior
      } finally {
        if (!cancelled) setLangLocked(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Cleanup — desbloquear idioma ao desmontar
  useEffect(() => {
    return () => { setLangLocked(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'safe': return '✓';
      case 'suspicious': return '⚠';
      case 'malicious': return '✕';
      default: return '?';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe': return '#00ff88';
      case 'suspicious': return '#ffaa00';
      case 'malicious': return '#ff4444';
      default: return '#888888';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'safe': return t('url.safe');
      case 'suspicious': return t('url.suspicious');
      case 'malicious': return t('url.malicious');
      default: return t('url.unknown');
    }
  };

  const getGoogleStatus = () => {
    if (!result?.threat_details?.google_safe_browsing?.checked) return 'unknown';
    return result.threat_details.google_safe_browsing.is_threat ? 'malicious' : 'safe';
  };

  const getSslStatus = () => {
    if (!result?.threat_details?.ssl_check?.checked) return 'unknown';
    return result.threat_details.ssl_check.status || 'unknown';
  };

  const tooltipText = t('url.cacheTooltip');

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="text"
            className="input"
            placeholder={t('url.placeholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <button type="submit" className="btn" disabled={!url.trim() || loading}>
          {loading ? t('url.checking') : t('url.check')}
        </button>
      </form>

      {error && (
        <div className="result-container">
          <div className="no-breaches" style={{ borderColor: 'var(--danger)' }}>
            <span className="status-badge danger">{t('url.error')}</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {(showGoogleLoading || showGoogleResult || showSslLoading || showSslResult) && (
        <div className="result-container">
          <div style={{ 
            padding: '1.5rem',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{ 
              margin: '0 0 1.5rem 0', 
              fontSize: '1.1rem',
              color: 'var(--text)',
              fontWeight: '600'
            }}>
              {t('url.title')}
            </h3>

            {/* Google Safe Browsing */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem',
              marginBottom: '1rem',
              padding: '0.75rem',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '8px'
            }}>
              <span style={{ minWidth: '140px', color: 'var(--gray)' }}>Google SB:</span>
              {showGoogleLoading && !showGoogleResult && (
                <div className="loading-spinner" style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderTop: '2px solid var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
              )}
              {showGoogleResult && (
                <span style={{ 
                  color: getStatusColor(getGoogleStatus()),
                  fontWeight: 'bold',
                  fontSize: '1.2rem'
                }}>
                  {getStatusIcon(getGoogleStatus())}
                </span>
              )}
            </div>

            {/* SSL Check */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem',
              marginBottom: '1rem',
              padding: '0.75rem',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '8px'
            }}>
              <span style={{ minWidth: '140px', color: 'var(--gray)' }}>Checker SSL:</span>
              {showSslLoading && !showSslResult && (
                <div className="loading-spinner" style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderTop: '2px solid var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
              )}
              {showSslResult && (
                <span style={{ 
                  color: getStatusColor(getSslStatus()),
                  fontWeight: 'bold',
                  fontSize: '1.2rem'
                }}>
                  {getStatusIcon(getSslStatus())}
                </span>
              )}
              {!showSslLoading && !showSslResult && showGoogleResult && (
                <span style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>{t('url.waiting')}</span>
              )}
            </div>

            {/* Status Final */}
            {showFinalStatus && result && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: `rgba(${result.status === 'safe' ? '0,255,136' : result.status === 'suspicious' ? '255,170,0' : '255,68,68'}, 0.1)`,
                borderRadius: '8px',
                borderLeft: `4px solid ${getStatusColor(result.status)}`,
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem'
                }}>
                  <span style={{ color: 'var(--gray)' }}>URL:</span>
                  <span style={{ 
                    color: getStatusColor(result.status),
                    fontWeight: 'bold',
                    fontSize: '1.1rem'
                  }}>
                    {getStatusText(result.status)}
                  </span>
                </div>
              </div>
            )}

            {/* Opinião da IA com efeito de typing */}
            {showAiOpinion && getAiOpinion() && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                borderLeft: '3px solid var(--primary)'
              }}>
                <p style={{ 
                  margin: '0 0 0.5rem 0', 
                  fontWeight: 'bold', 
                  color: 'var(--primary)',
                  fontSize: '0.9rem'
                }}>
                  {t('url.aiAgent')}
                </p>
                <p style={{ 
                  margin: 0, 
                  lineHeight: 1.6,
                  color: 'var(--text)',
                  minHeight: '3rem'
                }}>
                  {displayedText}
                  <span style={{ 
                    opacity: displayedText.length < (getAiOpinion()?.length || 0) ? 1 : 0,
                    animation: 'blink 0.7s infinite'
                  }}>|</span>
                </p>
              </div>
            )}

            {/* Info de verificação */}
            {showFinalStatus && result && (
              <div style={{
                marginTop: '2rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.25rem',
                position: 'relative'
              }}>
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--gray)'
                }}>
                  {result.from_cache 
                    ? t('url.cachedPreviously') 
                    : t('url.cached')}
                </span>
                <span 
                  style={{ 
                    cursor: 'pointer',
                    color: '#ff4444',
                    fontSize: '0.6rem',
                    fontWeight: 'bold',
                    fontStyle: 'italic',
                    position: 'relative',
                    verticalAlign: 'super',
                    marginLeft: '1px'
                  }}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  i
                </span>
                {showTooltip && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: '0',
                    padding: '0.75rem 1rem',
                    background: '#1a1a2e',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    lineHeight: '1.5',
                    width: '280px',
                    textAlign: 'left',
                    color: '#ccc',
                    zIndex: 1000,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                  }}>
                    {tooltipText}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}



      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
