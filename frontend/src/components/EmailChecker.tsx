'use client';

import { useState } from 'react';
import { checkEmailBreach, BreachInfo } from '@/lib/api';
import BreachResults from './BreachResults';
import { useLanguage } from '@/contexts/LanguageContext';

export default function EmailChecker() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    breaches: BreachInfo[];
    searched: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const data = await checkEmailBreach(email);
      setResult({
        found: data.found,
        breaches: data.breaches,
        searched: true,
      });
    } catch (err) {
      console.error('Error checking email:', err);
      setError(t('email.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="email"
            className="input"
            placeholder={t('email.placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn" disabled={loading || !email.trim()}>
          {loading ? t('email.checking') : t('email.check')}
        </button>
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <span>{t('email.searching')}</span>
        </div>
      )}

      {error && (
        <div className="result-container">
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {result && result.searched && !loading && (
        <BreachResults 
          found={result.found} 
          breaches={result.breaches} 
          type="email"
        />
      )}
    </div>
  );
}
