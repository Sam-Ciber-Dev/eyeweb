'use client';

import { useState } from 'react';
import EmailChecker from './EmailChecker';
import PhoneChecker from './PhoneChecker';
import { useLanguage } from '@/contexts/LanguageContext';

type DataTab = 'email' | 'phone';

export default function DataChecker() {
  const [activeTab, setActiveTab] = useState<DataTab>('email');
  const { t } = useLanguage();

  return (
    <div className="data-checker">
      {/* Sub-tabs para Email e Phone */}
      <div className="data-tabs">
        <button
          className={`data-tab ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          <i className="fa-solid fa-envelope"></i>
          {t('data.email')}
        </button>
        <button
          className={`data-tab ${activeTab === 'phone' ? 'active' : ''}`}
          onClick={() => setActiveTab('phone')}
        >
          <i className="fa-solid fa-phone"></i>
          {t('data.phone')}
        </button>
      </div>

      {/* Conteúdo */}
      <div className="data-content">
        {activeTab === 'email' && <EmailChecker />}
        {activeTab === 'phone' && <PhoneChecker />}
      </div>
    </div>
  );
}
