'use client';

import { useState } from 'react';
import { BreachInfo } from '@/lib/api';

interface BreachResultsProps {
  found: boolean;
  breaches: BreachInfo[];
  type: 'email' | 'phone';
}

// Tooltips informativos para cada campo
const TOOLTIPS = {
  breaches: 'Listas de dados comprometidos onde o teu dado foi encontrado. Cada "breach" representa uma fuga de dados de um serviço ou empresa.',
  data_info: 'Tipos de informação que podem ter sido expostos junto com o teu dado. Nem todos os breaches expõem os mesmos tipos de dados.',
  password: 'A tua password (ou o hash dela) pode ter sido exposta. Deves alterá-la imediatamente em todos os serviços onde a usas.',
  ip: 'O teu endereço IP foi registado. Isto pode revelar a tua localização aproximada na altura do breach.',
  username: 'O teu nome de utilizador foi exposto. Se usas o mesmo username em vários sites, podem tentar aceder a outras contas.',
  credit_card: 'Dados de cartão de crédito podem ter sido expostos. Contacta o teu banco se notares movimentos suspeitos.',
  history: 'O teu histórico de atividade (compras, pesquisas, etc.) pode ter sido exposto.',
  recommendations: 'Ações recomendadas para protegeres a tua segurança com base nos dados expostos.',
};

// Recomendações baseadas nos dados expostos
const RECOMMENDATIONS = {
  safe: {
    email: [
      'Continua a usar passwords fortes e únicas para cada serviço.',
      'Ativa a autenticação de dois fatores (2FA) sempre que possível.',
      'Mantém-te atento a emails de phishing.',
      'Verifica regularmente se os teus dados foram comprometidos.',
    ],
    phone: [
      'Tem cuidado com chamadas e SMS de números desconhecidos.',
      'Nunca partilhes códigos de verificação com terceiros.',
      'Ativa a verificação em dois passos nas tuas contas.',
      'Usa apps de mensagens com encriptação ponta-a-ponta.',
    ],
  },
  compromised: {
    password: [
      'URGENTE: Altera a tua password imediatamente.',
      'Usa uma password única com pelo menos 12 caracteres.',
      'Considera usar um gestor de passwords.',
      'Ativa 2FA em todas as contas importantes.',
    ],
    ip: [
      'A tua localização aproximada pode ter sido exposta.',
      'Considera usar uma VPN para navegação mais segura.',
      'Verifica se há atividade suspeita nas tuas contas.',
    ],
    username: [
      'Se usas este username noutros sites, verifica essas contas.',
      'Considera usar usernames diferentes para cada serviço.',
    ],
    credit_card: [
      'CRÍTICO: Contacta o teu banco imediatamente.',
      'Pede o cancelamento/substituição do cartão.',
      'Monitoriza os extratos para movimentos suspeitos.',
      'Considera ativar alertas de transação.',
    ],
    history: [
      'O teu histórico de atividade pode ter sido exposto.',
      'Revê as definições de privacidade das tuas contas.',
      'Considera limpar o histórico de serviços não essenciais.',
    ],
    general: [
      'Altera as passwords de todas as contas associadas.',
      'Ativa a autenticação de dois fatores (2FA).',
      'Monitoriza as tuas contas para atividade suspeita.',
      'Considera usar um serviço de monitorização de identidade.',
    ],
  },
};

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

function DataExposedItem({ label, exposed, tooltip }: { label: string; exposed: boolean; tooltip: string }) {
  return (
    <div className={`data-exposed-item ${exposed ? 'exposed' : 'safe'}`}>
      <span className="data-label">{label}</span>
      <span className={`data-status ${exposed ? 'yes' : 'no'}`}>
        {exposed ? 'Sim' : 'Não'}
      </span>
      <InfoTooltip text={tooltip} />
    </div>
  );
}

export default function BreachResults({ found, breaches, type }: BreachResultsProps) {
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
      return RECOMMENDATIONS.safe[type];
    }
    
    const recs: string[] = [...RECOMMENDATIONS.compromised.general];
    
    if (exposedData.password) {
      recs.unshift(...RECOMMENDATIONS.compromised.password);
    }
    if (exposedData.credit_card) {
      recs.unshift(...RECOMMENDATIONS.compromised.credit_card);
    }
    if (exposedData.ip) {
      recs.push(...RECOMMENDATIONS.compromised.ip);
    }
    if (exposedData.username) {
      recs.push(...RECOMMENDATIONS.compromised.username);
    }
    if (exposedData.history) {
      recs.push(...RECOMMENDATIONS.compromised.history);
    }
    
    // Remover duplicados e limitar
    return Array.from(new Set(recs)).slice(0, 6);
  };

  if (!found) {
    return (
      <div className="result-container">
        <div className="no-breaches">
          <p style={{ fontSize: '0.95rem', color: 'var(--success)', fontWeight: 600 }}>Nenhuma fuga de dados encontrada no Dataset.</p>
        </div>
        
        {/* Recomendações para dados seguros */}
        <div className="recommendations-section">
          <h4>
            Recomendações <InfoTooltip text={TOOLTIPS.recommendations} />
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
        Dados encontrados em {breaches.length} fuga{breaches.length !== 1 ? 's' : ''}.
      </p>
      
      {/* Lista de Breaches */}
      {breaches.map((breach, idx) => (
        <div key={idx} className="breach-item">
          <h4>{breach.name}</h4>
          <p><strong>Data:</strong> {breach.date}</p>
        </div>
      ))}
      
      {/* Informação Relacionada */}
      <div className="section-header" style={{ marginTop: '1.5rem' }}>
        <h3>Informação Relacionada</h3>
      </div>
      
      <div className="data-exposed-grid">
        <DataExposedItem 
          label="Password" 
          exposed={exposedData.password} 
          tooltip={TOOLTIPS.password}
        />
        <DataExposedItem 
          label="Endereço IP" 
          exposed={exposedData.ip} 
          tooltip={TOOLTIPS.ip}
        />
        <DataExposedItem 
          label="Username" 
          exposed={exposedData.username} 
          tooltip={TOOLTIPS.username}
        />
        <DataExposedItem 
          label="Cartão de Crédito" 
          exposed={exposedData.credit_card} 
          tooltip={TOOLTIPS.credit_card}
        />
        <DataExposedItem 
          label="Histórico" 
          exposed={exposedData.history} 
          tooltip={TOOLTIPS.history}
        />
      </div>
      
      {/* Recomendações */}
      <div className="recommendations-section danger">
        <h4>
          Recomendações <InfoTooltip text={TOOLTIPS.recommendations} />
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
