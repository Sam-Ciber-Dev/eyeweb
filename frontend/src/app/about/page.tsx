"use client";
import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import './about.css';

/* ─── Team Data ─── */
interface TeamMember {
  name: string;
  role: string;
  github: string;
  email?: string;
  linkedin?: string;
  website?: string;
  contributions: { task: string; pct: number }[];
}

const TEAM: TeamMember[] = [
  {
    name: 'Samuel Oliveira',
    role: 'Lead Developer',
    github: 'Sam-Ciber-Dev',
    email: 'sam.oliveira.dev@gmail.com',
    linkedin: 'https://linkedin.com/in/jose-samuel-oliveira/',
    website: 'https://sam-ciber-dev.github.io',
    contributions: [
      { task: 'Front-end', pct: 70 },
      { task: 'Base de Dados', pct: 80 },
      { task: 'Dataset', pct: 100 },
      { task: "API's", pct: 80 },
      { task: 'Área Admin', pct: 100 },
      { task: 'Segurança', pct: 80 },
      { task: 'SEO', pct: 20 },
      { task: 'ChatBot Users', pct: 20 },
      { task: 'Login System', pct: 100 },
    ],
  },
  {
    name: 'Ana Rita Monteiro',
    role: 'Designer & Developer',
    github: 'Galaxiay11',
    email: '',
    linkedin: 'https://www.linkedin.com/in/ana-rita-monteiro-b186a8359',
    website: '',
    contributions: [
      { task: 'Interface', pct: 100 },
      { task: 'Front-end', pct: 30 },
      { task: 'Base de Dados', pct: 20 },
      { task: 'SEO', pct: 50 },
      { task: 'ChatBot Users', pct: 20 },
      { task: 'Scripts de teste', pct: 20 },
      { task: 'Politicas', pct: 100 },
      { task: 'Relatório', pct: 60 },
      { task: 'Diagramas', pct: 30 },
      { task: 'PowerPoint', pct: 50 },
    ],
  },
  {
    name: 'Vanina Kollen',
    role: 'Developer',
    github: 'vankol06',
    email: '',
    linkedin: 'https://www.linkedin.com/in/vanina-kollen-337762397',
    website: '',
    contributions: [
      { task: 'Scripts de teste', pct: 40 },
      { task: "API's", pct: 10 },
      { task: 'SEO', pct: 20 },
      { task: 'ChatBot Users', pct: 20 },
      { task: 'Termos de Serviço', pct: 100 },
      { task: 'Relatório', pct: 35 },
      { task: 'PowerPoint', pct: 50 },
    ],
  },
  {
    name: 'Tiago Carvalho',
    role: 'Developer',
    github: 'Tiago0612',
    email: 'tiago.fsc.06@gmail.com',
    linkedin: 'https://www.linkedin.com/in/tiago-carvalho-890938284',
    website: '',
    contributions: [
      { task: 'Scripts de teste', pct: 40 },
      { task: "API's", pct: 10 },
      { task: 'SEO', pct: 10 },
      { task: 'Segurança', pct: 20 },
      { task: 'Relatório', pct: 5 },
    ],
  },
  {
    name: 'Francisco Ribeiro',
    role: 'Developer',
    github: 'Xico20230',
    email: 'kikorafa01@gmail.com',
    linkedin: 'https://www.linkedin.com/in/franciscorcribeiro/',
    website: '',
    contributions: [
      { task: 'Diagramas', pct: 70 },
    ],
  },
];

/* ─── Translations ─── */
const i18n = {
  pt: {
    subtitle: 'Plataforma de cibersegurança de nova geração. Protege os teus dados com inteligência.',
    langBtn: 'Switch to English',
    stats: { features: 'Funcionalidades', team: 'Equipa', encryption: 'Encriptação', uptime: 'Uptime' },
    statsVals: { features: '8+', team: '5', encryption: 'SHA-256', uptime: '99.9%' },
    motivationTitle: 'Porquê o EyeWeb?',
    motivationIcon: 'fa-solid fa-lightbulb',
    motivation1: 'O EyeWeb Reborn surgiu da necessidade de criar ferramentas automáticas e simplificadas para a proteção de dados online. O nosso propósito é democratizar o acesso à cibersegurança, prevenindo ataques através da utilização de agentes reativos inteligentes.',
    motivation2: 'Acreditamos que a segurança digital deve ser uma norma e não um obstáculo técnico, permitindo que a gestão de dados seja robusta, eficiente e acessível a todos.',
    aboutTitle: 'A Plataforma',
    aboutIcon: 'fa-solid fa-shield-halved',
    about: 'O EyeWeb Reborn é uma plataforma inovadora dedicada à análise e proteção de ativos digitais. O sistema permite identificar ameaças e vulnerabilidades de forma intuitiva, fornecendo informações detalhadas sempre que um dado pessoal ou credencial é identificado como comprometido.',
    featuresTitle: 'Funcionalidades',
    features: [
      { icon: 'fa-solid fa-globe', title: 'Análise de Websites', desc: 'Verificação de certificados, histórico de ameaças e ligações suspeitas.' },
      { icon: 'fa-solid fa-key', title: 'Auditoria de Credenciais', desc: 'Validação de passwords e e-mails contra bases de dados de fugas.' },
      { icon: 'fa-solid fa-phone-flip', title: 'Verificação de Dados', desc: 'Análise de telemóveis e outros identificadores digitais.' },
      { icon: 'fa-solid fa-robot', title: 'Agentes Reativos', desc: 'Sistemas inteligentes que minimizam riscos e sugerem correções.' },
    ],
    securityTitle: 'Segurança & Infraestrutura',
    securityIcon: 'fa-solid fa-lock',
    securityIntro: 'Infraestrutura desenhada sob princípios rigorosos de privacidade e defesa.',
    security: [
      { icon: 'fa-solid fa-fingerprint', title: 'Criptografia', desc: 'SHA-256 — nenhum dado é processado ou armazenado em texto limpo.' },
      { icon: 'fa-solid fa-user-secret', title: 'K-Anonymity', desc: 'Verificação de segurança sem transmitir credenciais completas.' },
      { icon: 'fa-solid fa-shield', title: 'HTTPS Obrigatório', desc: 'Encriptação em todo o tráfego de dados.' },
      { icon: 'fa-solid fa-code', title: 'Defesa de Backend', desc: 'Sanitização de inputs, rate limiting e proteção contra injection.' },
    ],
    teamTitle: 'A Equipa',
    teamIcon: 'fa-solid fa-users',
    teamClickHint: 'Clica para ver mais',
    contribTitle: 'Desenvolvimento',
  },
  en: {
    subtitle: 'Next-generation cybersecurity platform. Protect your data with intelligence.',
    langBtn: 'Mudar para Português',
    stats: { features: 'Features', team: 'Team', encryption: 'Encryption', uptime: 'Uptime' },
    statsVals: { features: '8+', team: '5', encryption: 'SHA-256', uptime: '99.9%' },
    motivationTitle: 'Why EyeWeb?',
    motivationIcon: 'fa-solid fa-lightbulb',
    motivation1: 'EyeWeb Reborn arose from the need to create automatic and simplified tools for online data protection. Our purpose is to democratize access to cybersecurity, preventing attacks through intelligent reactive agents.',
    motivation2: 'We believe digital security should be a standard, not a technical obstacle, allowing data management to be robust, efficient, and accessible to everyone.',
    aboutTitle: 'The Platform',
    aboutIcon: 'fa-solid fa-shield-halved',
    about: 'EyeWeb Reborn is an innovative platform dedicated to the analysis and protection of digital assets. The system intuitively identifies threats and vulnerabilities, providing detailed information whenever personal data or credentials are identified as compromised.',
    featuresTitle: 'Features',
    features: [
      { icon: 'fa-solid fa-globe', title: 'Website Analysis', desc: 'Certificate verification, threat history and suspicious link detection.' },
      { icon: 'fa-solid fa-key', title: 'Credential Audit', desc: 'Password and email validation against data breach databases.' },
      { icon: 'fa-solid fa-phone-flip', title: 'Data Verification', desc: 'Analysis tools for phone numbers and digital identifiers.' },
      { icon: 'fa-solid fa-robot', title: 'Reactive Agents', desc: 'Intelligent systems that minimize risks and suggest corrections.' },
    ],
    securityTitle: 'Security & Infrastructure',
    securityIcon: 'fa-solid fa-lock',
    securityIntro: 'Infrastructure designed under strict privacy and defense principles.',
    security: [
      { icon: 'fa-solid fa-fingerprint', title: 'Encryption', desc: 'SHA-256 — no data is processed or stored in plain text.' },
      { icon: 'fa-solid fa-user-secret', title: 'K-Anonymity', desc: 'Security verification without transmitting complete credentials.' },
      { icon: 'fa-solid fa-shield', title: 'Mandatory HTTPS', desc: 'Encryption for all data traffic.' },
      { icon: 'fa-solid fa-code', title: 'Backend Defense', desc: 'Input sanitization, rate limiting and injection protection.' },
    ],
    teamTitle: 'The Team',
    teamIcon: 'fa-solid fa-users',
    teamClickHint: 'Click for more',
    contribTitle: 'Development',
  },
};

/* ─── Component ─── */
export default function AboutPage() {
  const { lang } = useLanguage();
  const [expandedMember, setExpandedMember] = useState<number | null>(null);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const t = i18n[lang];

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.15 }
    );

    sectionRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const setSectionRef = (id: string) => (el: HTMLDivElement | null) => {
    sectionRefs.current.set(id, el);
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <Navbar />
      <div className="about-page">
        {/* ─── Hero ─── */}
        <section className="about-hero">
          <h1>Eye Web</h1>
        </section>

        {/* ─── Stats Bar ─── */}
        <div className="about-stats">
          <div className="stat-card">
            <span className="stat-number">{t.statsVals.features}</span>
            <span className="stat-label">{t.stats.features}</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{t.statsVals.team}</span>
            <span className="stat-label">{t.stats.team}</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{t.statsVals.encryption}</span>
            <span className="stat-label">{t.stats.encryption}</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{t.statsVals.uptime}</span>
            <span className="stat-label">{t.stats.uptime}</span>
          </div>
        </div>

        {/* ─── Content Sections ─── */}
        <div className="about-section-wrapper">
          {/* Motivation */}
          <div
            id="motivation"
            ref={setSectionRef('motivation')}
            className="about-section-card"
            style={{ opacity: visibleSections.has('motivation') ? 1 : 0, transform: visibleSections.has('motivation') ? 'translateY(0)' : 'translateY(40px)', transition: 'all 0.8s ease' }}
          >
            <div className="section-header">
              <div className="section-icon">
                <i className={t.motivationIcon}></i>
              </div>
              <h2><span className="accent">{t.motivationTitle}</span></h2>
            </div>
            <p>{t.motivation1}</p>
            <p style={{ marginTop: '0.75rem' }}>{t.motivation2}</p>
          </div>

          {/* About & Features */}
          <div
            id="platform"
            ref={setSectionRef('platform')}
            className="about-section-card"
            style={{ opacity: visibleSections.has('platform') ? 1 : 0, transform: visibleSections.has('platform') ? 'translateY(0)' : 'translateY(40px)', transition: 'all 0.8s ease 0.1s' }}
          >
            <div className="section-header">
              <div className="section-icon">
                <i className={t.aboutIcon}></i>
              </div>
              <h2><span className="accent">{t.aboutTitle}</span></h2>
            </div>
            <p>{t.about}</p>

            <h3 style={{ color: 'var(--white)', marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 600 }}>
              {t.featuresTitle}
            </h3>
            <div className="feature-grid">
              {t.features.map((f, i) => (
                <div key={i} className="feature-item" style={{ animationDelay: `${0.1 * i}s` }}>
                  <div className="feature-icon">
                    <i className={f.icon}></i>
                  </div>
                  <div>
                    <h4>{f.title}</h4>
                    <p>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security */}
          <div
            id="security"
            ref={setSectionRef('security')}
            className="about-section-card"
            style={{ opacity: visibleSections.has('security') ? 1 : 0, transform: visibleSections.has('security') ? 'translateY(0)' : 'translateY(40px)', transition: 'all 0.8s ease 0.2s' }}
          >
            <div className="section-header">
              <div className="section-icon">
                <i className={t.securityIcon}></i>
              </div>
              <h2><span className="accent">{t.securityTitle}</span></h2>
            </div>
            <p>{t.securityIntro}</p>
            <div className="security-grid">
              {t.security.map((s, i) => (
                <div key={i} className="security-item">
                  <div className="sec-icon"><i className={s.icon}></i></div>
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div
            id="team"
            ref={setSectionRef('team')}
            className="about-section-card"
            style={{ opacity: visibleSections.has('team') ? 1 : 0, transform: visibleSections.has('team') ? 'translateY(0)' : 'translateY(40px)', transition: 'all 0.8s ease 0.3s' }}
          >
            <div className="section-header">
              <div className="section-icon">
                <i className={t.teamIcon}></i>
              </div>
              <h2><span className="accent">{t.teamTitle}</span></h2>
            </div>
            <div className="team-grid">
              {TEAM.map((member, i) => (
                <div
                  key={i}
                  className={`team-card ${expandedMember === i ? 'expanded' : ''}`}
                  onClick={() => setExpandedMember(expandedMember === i ? null : i)}
                >
                  <div className="team-avatar">{getInitials(member.name)}</div>
                  <h4>{member.name}</h4>
                  <div className="team-role">{member.role}</div>
                  {expandedMember !== i && (
                    <div className="team-click-hint">{t.teamClickHint}</div>
                  )}

                  {expandedMember === i && (
                    <div className="team-details">
                      {/* Contributions */}
                      {member.contributions.length > 0 && (
                        <div className="team-contributions">
                          <h5>{t.contribTitle}</h5>
                          {member.contributions.map((c, j) => (
                            <div key={j} className="contrib-item">
                              <div className="contrib-label">
                                <span>{c.task}</span>
                                <span>{c.pct}%</span>
                              </div>
                              <div className="contrib-bar">
                                <div
                                  className="contrib-fill"
                                  style={{ width: expandedMember === i ? `${c.pct}%` : '0%' }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Social Icons */}
                      <div className="team-social-icons">
                        {member.linkedin && (
                          <a href={member.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn" onClick={(e) => e.stopPropagation()}>
                            <i className="fa-brands fa-linkedin"></i>
                          </a>
                        )}
                        <a href={`https://github.com/${member.github}`} target="_blank" rel="noopener noreferrer" title="GitHub" onClick={(e) => e.stopPropagation()}>
                          <i className="fa-brands fa-github"></i>
                        </a>
                        {member.email && (
                          <a href={`https://outlook.live.com/mail/0/deeplink/compose?to=${member.email}`} target="_blank" rel="noopener noreferrer" title="Email" onClick={(e) => e.stopPropagation()}>
                            <i className="fa-solid fa-envelope"></i>
                          </a>
                        )}
                        {member.website && (
                          <a href={member.website} target="_blank" rel="noopener noreferrer" title="Website" onClick={(e) => e.stopPropagation()}>
                            <i className="fa-solid fa-globe"></i>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}