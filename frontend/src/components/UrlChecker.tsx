'use client';

import { useState, useEffect } from 'react';
import { checkUrlWithAI, UrlCheckResult } from '@/lib/api';

export default function UrlChecker() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UrlCheckResult | null>(null);
  
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) return;
    
    // Reset estados
    setLoading(true);
    setError(null);
    setResult(null);
    setShowGoogleLoading(false);
    setShowGoogleResult(false);
    setShowSslLoading(false);
    setShowSslResult(false);
    setShowFinalStatus(false);
    setShowAiOpinion(false);
    setDisplayedText('');

    try {
      // Iniciar animação do Google
      setShowGoogleLoading(true);
      
      const data = await checkUrlWithAI(url);
      setResult(data);
      
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
      setError(err instanceof Error ? err.message : 'Erro ao verificar URL');
      setShowGoogleLoading(false);
    } finally {
      setLoading(false);
    }
  };

  // Efeito de typing para a opinião da IA
  useEffect(() => {
    if (showAiOpinion && result?.ai_opinion) {
      let index = 0;
      const text = result.ai_opinion;
      setDisplayedText('');
      
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayedText(text.substring(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 20);
      
      return () => clearInterval(interval);
    }
  }, [showAiOpinion, result?.ai_opinion]);

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
      case 'safe': return 'Seguro';
      case 'suspicious': return 'Suspeito';
      case 'malicious': return 'Perigoso';
      default: return 'Desconhecido';
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

  const tooltipText = "Quando verificas um URL, guardamos o resultado para que futuras verificações sejam instantâneas. Após 1 mês, o URL é automaticamente re-verificado para garantir informação atualizada.";

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="text"
            className="input"
            placeholder="Introduz um URL para verificar..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <button type="submit" className="btn" disabled={!url.trim() || loading}>
          {loading ? '🔄 A verificar...' : 'Verificar URL'}
        </button>
      </form>

      {error && (
        <div className="result-container">
          <div className="no-breaches" style={{ borderColor: 'var(--danger)' }}>
            <span className="status-badge danger">❌ Erro</span>
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
              Verificação de URL
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
              <span style={{ minWidth: '140px', color: 'var(--gray)' }}>Google Safe Browsing:</span>
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
              <span style={{ minWidth: '140px', color: 'var(--gray)' }}>Certificado SSL:</span>
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
                <span style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>A aguardar...</span>
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
            {showAiOpinion && result?.ai_opinion && (
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
                  🤖 Análise IA:
                </p>
                <p style={{ 
                  margin: 0, 
                  lineHeight: 1.6,
                  color: 'var(--text)',
                  minHeight: '3rem'
                }}>
                  {displayedText}
                  <span style={{ 
                    opacity: displayedText.length < (result.ai_opinion?.length || 0) ? 1 : 0,
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
                    ? 'URL verificado anteriormente pelos serviços do Eye Web' 
                    : 'URL verificado pelo Eye Web'}
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

      <p style={{ color: 'var(--gray)', fontSize: '0.8rem', marginTop: '1rem', textAlign: 'center' }}>
        🤖 Verificação com IA (Google Safe Browsing + SSL + Llama 3)
      </p>

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
