'use client';

import { useState } from 'react';
import { BreachInfo } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface BreachResultsProps {
  found: boolean;
  breaches: BreachInfo[];
  type: 'email' | 'phone';
}

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  
  return (
    <span 
      className="info-tooltip-container"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow(!show)}
    >
      <span className="info-icon" style={{ color: 'var(--danger)', fontStyle: 'italic', fontWeight: 'bold', fontSize: '0.85rem' }}>i*</span>
      {show && (
        <div className="info-tooltip">
          {text}
        </div>
      )}
    </span>
  );
}

function DataExposedItem({ label, exposed, tooltip, yesText, noText }: { label: string; exposed: boolean; tooltip: string; yesText: string; noText: string }) {
  return (
    <div className={`data-exposed-item ${exposed ? 'exposed' : 'safe'}`}>
      <span className="data-label">{label}</span>
      <span className={`data-status ${exposed ? 'yes' : 'no'}`}>
        {exposed ? yesText : noText}
      </span>
      <InfoTooltip text={tooltip} />
    </div>
  );
}

export default function BreachResults({ found, breaches, type }: BreachResultsProps) {
  const { t } = useLanguage();

  // Calcular quais tipos de dados foram expostos (agregado de todos os breaches)
  const exposedData = {
    password: breaches.some(b => b.has_password),
    ip: breaches.some(b => b.has_ip),
    username: breaches.some(b => b.has_username),
    credit_card: breaches.some(b => b.has_credit_card),
    history: breaches.some(b => b.has_history),
  };

  // Gerar recomendações personalizadas
  const getRecommendations = () => {
    if (!found) {
      if (type === 'phone') {
        return [t('breach.phone.1'), t('breach.phone.2'), t('breach.phone.3'), t('breach.phone.4')];
      }
      return [t('breach.safe.1'), t('breach.safe.2'), t('breach.safe.3'), t('breach.safe.4')];
    }
    
    const recs: string[] = [t('breach.gen.1'), t('breach.gen.2'), t('breach.gen.3'), t('breach.gen.4')];
    
    if (exposedData.password) {
      recs.unshift(t('breach.pwd.1'), t('breach.pwd.2'), t('breach.pwd.3'), t('breach.pwd.4'));
    }
    if (exposedData.credit_card) {
      recs.unshift(t('breach.cc.1'), t('breach.cc.2'), t('breach.cc.3'), t('breach.cc.4'));
    }
    if (exposedData.ip) {
      recs.push(t('breach.ip.1'), t('breach.ip.2'), t('breach.ip.3'));
    }
    if (exposedData.username) {
      recs.push(t('breach.user.1'), t('breach.user.2'));
    }
    if (exposedData.history) {
      recs.push(t('breach.hist.1'), t('breach.hist.2'), t('breach.hist.3'));
    }
    
    // Remover duplicados e limitar
    return Array.from(new Set(recs)).slice(0, 6);
  };

  if (!found) {
    return (
      <div className="result-container">
        <div className="no-breaches">
          <p style={{ fontSize: '0.95rem', color: 'var(--success)', fontWeight: 600 }}>{t('breach.noBreaches')}</p>
        </div>
        
        {/* Recomendações para dados seguros */}
        <div className="recommendations-section">
          <h4>
            {t('breach.recommendations')} <InfoTooltip text={t('breach.tooltip.recommendations')} />
          </h4>
          <ul className="recommendations-list safe">
            {getRecommendations().map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="result-container">
      {/* Cabeçalho */}
      <p style={{ fontSize: '1.1rem', color: 'var(--danger)', fontWeight: 600, marginBottom: '1rem' }}>
        {t('breach.foundIn')} {breaches.length} {breaches.length !== 1 ? t('breach.breaches') : t('breach.breach')}.
      </p>
      
      {/* Lista de Breaches */}
      {breaches.map((breach, idx) => (
        <div key={idx} className="breach-item">
          <h4>{breach.name}</h4>
          <p><strong>{t('breach.date')}</strong> {breach.date}</p>
        </div>
      ))}
      
      {/* Informação Relacionada */}
      <div className="section-header" style={{ marginTop: '1.5rem' }}>
        <h3>{t('breach.relatedInfo')}</h3>
      </div>
      
      <div className="data-exposed-grid">
        <DataExposedItem 
          label="Password" 
          exposed={exposedData.password} 
          tooltip={t('breach.tooltip.password')}
          yesText={t('breach.yes')}
          noText={t('breach.no')}
        />
        <DataExposedItem 
          label={t('breach.ipAddress')} 
          exposed={exposedData.ip} 
          tooltip={t('breach.tooltip.ip')}
          yesText={t('breach.yes')}
          noText={t('breach.no')}
        />
        <DataExposedItem 
          label="Username" 
          exposed={exposedData.username} 
          tooltip={t('breach.tooltip.username')}
          yesText={t('breach.yes')}
          noText={t('breach.no')}
        />
        <DataExposedItem 
          label={t('breach.creditCard')} 
          exposed={exposedData.credit_card} 
          tooltip={t('breach.tooltip.creditCard')}
          yesText={t('breach.yes')}
          noText={t('breach.no')}
        />
        <DataExposedItem 
          label={t('breach.history')} 
          exposed={exposedData.history} 
          tooltip={t('breach.tooltip.history')}
          yesText={t('breach.yes')}
          noText={t('breach.no')}
        />
      </div>
      
      {/* Recomendações */}
      <div className="recommendations-section danger">
        <h4>
          {t('breach.recommendations')} <InfoTooltip text={t('breach.tooltip.recommendations')} />
        </h4>
        <ul className="recommendations-list">
          {getRecommendations().map((rec, idx) => (
            <li key={idx}>{rec}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
