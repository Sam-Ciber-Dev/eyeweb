'use client';

import { useState } from 'react';
import { checkUrlWithAI, UrlCheckResult } from '@/lib/api';

export default function UrlChecker() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UrlCheckResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await checkUrlWithAI(url);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao verificar URL');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'safe':
        return <span className="status-badge safe">🔒 URL Seguro</span>;
      case 'suspicious':
        return <span className="status-badge warning">⚠️ URL Suspeito</span>;
      case 'malicious':
        return <span className="status-badge danger">🚨 URL Perigoso</span>;
      case 'analyzing':
        return <span className="status-badge">🔄 A analisar...</span>;
      default:
        return <span className="status-badge">❓ Desconhecido</span>;
    }
  };

  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipText = "Quando verificas um URL, guardamos o resultado para que futuras verificações do mesmo URL sejam instantâneas. Após 1 mês, o URL é automaticamente re-verificado para garantir que a informação está atualizada.";

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

      {result && (
        <div className="result-container">
          <div className={result.status === 'safe' ? 'no-breaches' : ''}>
            {getStatusBadge(result.status)}
            
            {/* Opinião da IA */}
            {result.ai_opinion && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: 'rgba(255,255,255,0.05)', 
                borderRadius: '8px',
                borderLeft: '3px solid var(--primary)'
              }}>
                <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                  🤖 Análise IA:
                </p>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{result.ai_opinion}</p>
              </div>
            )}

            {/* Detalhes dos scanners */}
            <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--gray)' }}>
              <p style={{ marginBottom: '0.5rem' }}><strong>Verificações:</strong></p>
              
              {/* Google Safe Browsing */}
              <p style={{ margin: '0.25rem 0' }}>
                • Google Safe Browsing: {' '}
                {result.threat_details.google_safe_browsing?.checked ? (
                  result.threat_details.google_safe_browsing.is_threat ? (
                    <span style={{ color: 'var(--danger)' }}>⚠️ Ameaça detectada</span>
                  ) : (
                    <span style={{ color: 'var(--success)' }}>✅ Limpo</span>
                  )
                ) : (
                  <span style={{ color: 'var(--warning)' }}>❓ Não verificado</span>
                )}
              </p>
            </div>

            {/* Info de verificação */}
            <p style={{ 
              marginTop: '1rem', 
              fontSize: '0.8rem', 
              color: 'var(--gray)',
              textAlign: 'right',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.25rem'
            }}>
              {result.from_cache ? 'URL verificado anteriormente pelos serviços do Eye Web' : 'URL verificado pelo Eye Web'}
              <span 
                style={{ 
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  fontSize: '0.7rem',
                  fontWeight: 'bold'
                }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                i
                {showTooltip && (
                  <span style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: '0',
                    marginBottom: '8px',
                    padding: '0.75rem',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--gray)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    lineHeight: '1.4',
                    width: '250px',
                    textAlign: 'left',
                    color: 'var(--text)',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}>
                    {tooltipText}
                  </span>
                )}
              </span>
            </p>
          </div>
        </div>
      )}

      <p style={{ color: 'var(--gray)', fontSize: '0.8rem', marginTop: '1rem', textAlign: 'center' }}>
        🤖 Verificação com IA (Google Safe Browsing + Llama 3)
      </p>
    </div>
  );
}
