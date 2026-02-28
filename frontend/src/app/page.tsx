'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import EyeIntro from '@/components/EyeIntro';
import Tabs from '@/components/Tabs';
import DataChecker from '@/components/DataChecker';
import UrlChecker from '@/components/UrlChecker';
import PasswordChecker from '@/components/PasswordChecker';
import Footer from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Home() {
  const [showContent, setShowContent] = useState(false);
  const [activeTab, setActiveTab] = useState('data');
  const { t } = useLanguage();

  const TABS = [
    { id: 'data', label: t('tab.data'), icon: '' },
    { id: 'password', label: t('tab.password'), icon: '' },
    { id: 'url', label: t('tab.url'), icon: '' },
  ];

  const handleIntroComplete = () => {
    setShowContent(true);
  };

  return (
    <>
      {/* Animação do Olho */}
      <EyeIntro onComplete={handleIntroComplete} />

      {/* Conteúdo Principal */}
      <div className={`main-content ${showContent ? 'visible' : ''}`}>
        <Navbar />

        <div className="container">
          <header className="header">
            <h1>Eye Web</h1>
            <p className="home-typing-text">{t('home.tagline')}</p>
          </header>

          <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Conteúdo das Tabs */}
          {activeTab === 'data' && (
            <section>
              <DataChecker />
            </section>
          )}

          {activeTab === 'url' && (
            <section>
              <UrlChecker />
            </section>
          )}

          {activeTab === 'password' && (
            <section>
              <PasswordChecker />
            </section>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}
