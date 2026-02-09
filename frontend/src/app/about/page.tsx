"use client";
import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function AboutPage() {
  const [lang, setLang] = React.useState<'pt' | 'en'>('pt');

  // Conteúdo PT
  const pt = {
    motivationTitle: 'Motivação: Porquê o EyeWeb Reborn?',
    motivation1: 'O EyeWeb Reborn surgiu da necessidade de criar ferramentas automáticas e simplificadas para a proteção de dados online. O nosso propósito é democratizar o acesso à cibersegurança, prevenindo ataques através da utilização de agentes reativos inteligentes que auxiliam tanto utilizadores comuns como administradores de sistemas.',
    motivation2: 'Acreditamos que a segurança digital deve ser uma norma e não um obstáculo técnico, permitindo que a gestão de dados seja robusta, eficiente e acessível a todos.',
    aboutTitle: 'Sobre a Plataforma',
    about: 'O EyeWeb Reborn é uma plataforma inovadora dedicada à análise e proteção de ativos digitais. O sistema permite identificar ameaças e vulnerabilidades de forma intuitiva, fornecendo informações detalhadas sempre que um dado pessoal ou credencial é identificado como comprometido.',
    featuresTitle: 'Funcionalidades Principais',
    features: [
      'Análise de Websites: Verificação de certificados de segurança, histórico de ameaças e identificação de ligações suspeitas.',
      'Auditoria de Credenciais: Validação de palavras-passe e e-mails através de bases de dados de fugas de dados, garantindo a integridade do utilizador.',
      'Verificação de Dados: Ferramentas de análise para números de telemóvel e outros identificadores digitais.',
      'Agentes Reativos: Sistemas inteligentes usados para minimizar riscos e sugerir medidas corretivas imediatas.'
    ],
    infraTitle: 'Infraestrutura e Segurança',
    infraIntro: 'A nossa infraestrutura foi desenhada sob princípios rigorosos de privacidade e defesa para garantir que o utilizador está sempre protegido.',
    infra: [
      'Criptografia: Utilização de algoritmos SHA-256 para garantir que nenhum dado é processado ou armazenado em texto limpo.',
      'Anonimato: Implementação de K-Anonymity, permitindo a verificação de segurança sem que as credenciais completas sejam transmitidas.',
      'Segurança no Transporte: Encriptação HTTPS obrigatória em todo o tráfego de dados.',
      'Defesa de Infraestrutura: Camadas de sanitização de inputs e mecanismos de rate limiting no backend para prevenir abusos e ataques de injection.'
    ],
    teamTitle: 'Equipa',
    team: [
      { name: 'Ana Rita da Silva Monteiro', github: 'Galaxiay11' },
      { name: 'José Samuel da Rocha Oliveira', github: 'Sam-Ciber-Dev' },
      { name: 'Tiago Filipe Sousa Carvalho', github: 'Tiago0612' },
      { name: 'Vanina Kollen', github: 'vankol06' },
      { name: 'Francisco Rafael Carocinho Ribeiro', github: 'Xico20230' }
    ]
  };

  // English Content 
  const en = {
    motivationTitle: 'Motivation: Why EyeWeb Reborn?',
    motivation1: 'EyeWeb Reborn arose from the need to create automatic and simplified tools for online data protection. Our purpose is to democratize access to cybersecurity, preventing attacks through the use of intelligent reactive agents that help both regular users and system administrators.',
    motivation2: 'We believe that digital security should be a standard, not a technical obstacle, allowing data management to be robust, efficient, and accessible to everyone.',
    aboutTitle: 'About the Platform',
    about: 'EyeWeb Reborn is an innovative platform dedicated to the analysis and protection of digital assets. The system allows intuitive identification of threats and vulnerabilities, providing detailed information whenever personal data or credentials are identified as compromised.',
    featuresTitle: 'Main Features',
    features: [
      'Website Analysis: Security certificate verification, threat history, and identification of suspicious links.',
      'Credential Audit: Validation of passwords and emails through data breach databases, ensuring user integrity.',
      'Data Verification: Analysis tools for phone numbers and other digital identifiers.',
      'Reactive Agents: Intelligent systems used to minimize risks and suggest immediate corrective measures.'
    ],
    infraTitle: 'Infrastructure and Security',
    infraIntro: 'Our infrastructure was designed under strict privacy and defense principles to ensure the user is always protected.',
    infra: [
      'Encryption: Use of SHA-256 algorithms to ensure no data is processed or stored in plain text.',
      'Anonymity: Implementation of K-Anonymity, allowing security verification without transmitting complete credentials.',
      'Transport Security: Mandatory HTTPS encryption for all data traffic.',
      'Infrastructure Defense: Layers of input sanitization and backend rate limiting mechanisms to prevent abuse and injection attacks.'
    ],
    teamTitle: 'Team',
    team: [
      { name: 'Ana Rita da Silva Monteiro', github: 'Galaxiay11' },
      { name: 'José Samuel da Rocha Oliveira', github: 'Sam-Ciber-Dev' },
      { name: 'Tiago Filipe Sousa Carvalho', github: 'Tiago0612' },
      { name: 'Vanina Kollen', github: 'vankol06' },
      { name: 'Francisco Rafael Carocinho Ribeiro', github: 'Xico20230' }
    ]
  };

  const content = lang === 'pt' ? pt : en;

  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 0' }}>
        <header className="header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1>EyeWeb Reborn</h1>
          <button
            style={{ marginTop: '1rem', padding: '0.25rem 0.8rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', background: '#e53935', color: '#fff', cursor: 'pointer', fontSize: '0.95rem' }}
            onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
          >
            {lang === 'pt' ? 'Switch to English' : 'Mudar para Português'}
          </button>
        </header>
        <nav className="about-nav" style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
          <a href="#motivation" style={{ color: '#fff', textDecoration: 'none' }}>{content.motivationTitle}</a>
          <a href="#about" style={{ color: '#fff', textDecoration: 'none' }}>{content.aboutTitle}</a>
          <a href="#team" style={{ color: '#fff', textDecoration: 'none' }}>{content.teamTitle}</a>
          <a href="#security" style={{ color: '#fff', textDecoration: 'none' }}>{content.infraTitle}</a>
          <style>{`
            html {
              scroll-behavior: smooth;
            }
          `}</style>
        </nav>
        <section id="motivation" className="about-section" style={{ marginBottom: '2rem', scrollMarginTop: '100px' }}>
          <h2 style={{ color: '#e53935', fontWeight: 'bold' }}>{content.motivationTitle}</h2>
          <p>{content.motivation1}</p>
          <p>{content.motivation2}</p>
        </section>
        <section id="about" className="about-section" style={{ marginBottom: '2rem', scrollMarginTop: '100px' }}>
          <h2 style={{ color: '#e53935', fontWeight: 'bold' }}>{content.aboutTitle}</h2>
          <p>{content.about}</p>
          <h3 style={{ marginTop: '1.5rem', color: '#fff' }}>{content.featuresTitle}</h3>
          <ul style={{ marginLeft: '1.5rem', color: '#fff' }}>
            {content.features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
        <section id="team" className="about-section" style={{ marginBottom: '2rem', scrollMarginTop: '100px' }}>
          <h2 style={{ color: '#e53935', fontWeight: 'bold' }}>{content.teamTitle}</h2>
          <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: '1rem', color: '#fff' }}>
            {content.team.map((member, i) => (
              <li key={i} style={{ marginBottom: '0.5rem' }}>
                <strong>{member.name}</strong> — <a href={`https://github.com/${member.github}`} target="_blank" rel="noopener noreferrer" style={{ color: '#90caf9', fontWeight: 'bold' }}>{member.github}</a>
              </li>
            ))}
          </ul>
        </section>
        <section id="security" className="about-section" style={{ marginBottom: '2rem', scrollMarginTop: '100px' }}>
          <h2 style={{ color: '#e53935', fontWeight: 'bold' }}>{content.infraTitle}</h2>
          <p>{content.infraIntro}</p>
          <ul style={{ marginLeft: '1.5rem', color: '#fff' }}>
            {content.infra.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
      <Footer />
    </>
  );
}
