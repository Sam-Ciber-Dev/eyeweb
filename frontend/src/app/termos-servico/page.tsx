"use client";
import React, { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import '../legal.css';

const SECTIONS_PT = [
  {
    num: '1',
    title: 'Aceitação dos Termos',
    content: (
      <>
        <p>
          Ao aceder e utilizar o Eye Web Reborn, concorda com os presentes Termos de Serviço na sua totalidade.
          Se não concordar com alguma das condições aqui descritas, não deverá utilizar a plataforma.
        </p>
        <p>
          A utilização continuada da plataforma após alterações aos termos constitui aceitação automática
          das condições atualizadas. Recomendamos a consulta periódica desta página.
        </p>
      </>
    ),
  },
  {
    num: '2',
    title: 'Descrição do Serviço',
    content: (
      <>
        <p>O Eye Web Reborn é uma plataforma de cibersegurança que oferece:</p>
        <ul>
          <li><strong>Verificação de e-mails</strong> em bases de dados de fugas de dados (data breaches), utilizando o modelo K-Anonymity para proteção dos dados do utilizador.</li>
          <li><strong>Auditoria de segurança de palavras-passe</strong> — verificação local no navegador com comparação de hashes SHA-256 sem transmissão da password.</li>
          <li><strong>Análise de segurança de URLs e websites</strong> — certificados SSL, histórico de ameaças e ligações suspeitas.</li>
          <li><strong>Monitorização de tráfego e deteção de ameaças</strong> — sistema de defesa ativo contra abusos, scanners e ataques automatizados.</li>
          <li><strong>Chatbot de suporte</strong> — assistente inteligente para orientar utilizadores nas funcionalidades da plataforma.</li>
        </ul>
      </>
    ),
  },
  {
    num: '3',
    title: 'Utilização Adequada',
    content: (
      <>
        <p>O utilizador compromete-se a respeitar as seguintes condições de utilização:</p>
        <ul>
          <li>Utilizar a plataforma exclusivamente para fins legítimos de verificação de segurança pessoal.</li>
          <li>Não tentar comprometer, sobrecarregar ou atacar os serviços da plataforma.</li>
          <li>Não utilizar ferramentas automatizadas para scraping, crawling ou abuso dos endpoints da API.</li>
          <li>Verificar apenas dados que lhe pertençam ou para os quais tenha autorização expressa.</li>
          <li>Não partilhar resultados de verificação de terceiros sem consentimento prévio.</li>
          <li>Não utilizar a plataforma para fins ilegais, incluindo a tentativa de aceder a dados de outros utilizadores.</li>
        </ul>
        <div className="legal-highlight">
          <i className="fa-solid fa-triangle-exclamation legal-highlight-icon"></i>
          <p>O incumprimento destas regras pode resultar no bloqueio imediato e permanente do acesso à plataforma.</p>
        </div>
      </>
    ),
  },
  {
    num: '4',
    title: 'Privacidade e Segurança dos Dados',
    content: (
      <>
        <p>
          A plataforma foi construída com o princípio de <strong>privacidade por design</strong>. Utilizamos o modelo
          K-Anonymity, garantindo que os seus dados pessoais nunca são transmitidos em texto claro para os nossos servidores.
        </p>
        <p>
          As passwords verificadas nunca saem do seu navegador. A verificação de e-mails utiliza apenas um prefixo
          do hash SHA-256, impossibilitando a reconstrução do endereço original.
        </p>
        <p>
          Para mais detalhes sobre os dados que recolhemos e como os protegemos, consulte a nossa{' '}
          <a href="/politicas-privacidade">Política de Privacidade</a>.
        </p>
      </>
    ),
  },
  {
    num: '5',
    title: 'Propriedade Intelectual',
    content: (
      <>
        <p>
          Todo o conteúdo, código-fonte, design, logótipos e funcionalidades do Eye Web Reborn são propriedade
          dos seus criadores e estão protegidos por direitos de autor.
        </p>
        <p>
          É proibida a reprodução, modificação, distribuição ou utilização comercial de qualquer componente
          da plataforma sem autorização prévia e escrita.
        </p>
      </>
    ),
  },
  {
    num: '6',
    title: 'Limitação de Responsabilidade',
    content: (
      <>
        <p>
          O Eye Web Reborn é fornecido &quot;tal como está&quot; (<em>as is</em>). Embora nos esforcemos para manter informações
          precisas e atualizadas, não garantimos que os resultados de verificação sejam 100% completos ou atuais.
        </p>
        <p>
          A ausência de resultados numa verificação <strong>não garante</strong> que os dados nunca foram comprometidos.
          Os resultados dependem das bases de dados disponíveis no momento da consulta.
        </p>
        <p>
          Não nos responsabilizamos por danos diretos, indiretos, incidentais ou consequenciais resultantes
          da utilização ou impossibilidade de utilização da plataforma.
        </p>
      </>
    ),
  },
  {
    num: '7',
    title: 'Bloqueio de Acesso',
    content: (
      <>
        <p>
          Reservamo-nos o direito de bloquear automaticamente qualquer IP ou dispositivo que apresente
          comportamento malicioso, incluindo mas não limitado a:
        </p>
        <ul>
          <li>Tentativas de SQL injection ou XSS.</li>
          <li>Scanning de vulnerabilidades e fingerprinting agressivo.</li>
          <li>Ataques de força bruta (brute force) contra qualquer endpoint.</li>
          <li>Excesso de requests (DDoS) ou abuso de rate limits.</li>
          <li>Utilização de VPNs, proxies ou Tor para evadir bloqueios anteriores.</li>
        </ul>
        <div className="legal-highlight">
          <i className="fa-solid fa-shield-halved legal-highlight-icon"></i>
          <p>Os bloqueios são aplicados automaticamente pelo sistema de defesa e podem ser permanentes em casos de reincidência.</p>
        </div>
      </>
    ),
  },
  {
    num: '8',
    title: 'Alterações aos Termos',
    content: (
      <>
        <p>
          Reservamo-nos o direito de modificar estes Termos de Serviço a qualquer momento.
          As alterações entram em vigor imediatamente após a sua publicação nesta página.
        </p>
        <p>
          O uso continuado da plataforma após alterações constitui aceitação das novas condições.
        </p>
        <p style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
          Última atualização: Fevereiro 2026
        </p>
      </>
    ),
  },
  {
    num: '9',
    title: 'Contacto',
    content: (
      <>
        <p>
          Para questões, dúvidas ou esclarecimentos sobre estes Termos de Serviço, pode contactar-nos através do e-mail:{' '}
          <a href="https://outlook.live.com/mail/0/deeplink/compose?to=suporte@eyeweb.pt" target="_blank" rel="noopener noreferrer">suporte@eyeweb.pt</a>.
        </p>
      </>
    ),
  },
];

const SECTIONS_EN = [
  {
    num: '1',
    title: 'Acceptance of Terms',
    content: (
      <>
        <p>By accessing and using Eye Web Reborn, you agree to these Terms of Service in their entirety. If you do not agree with any of the conditions described here, you should not use the platform.</p>
        <p>Continued use of the platform after changes to the terms constitutes automatic acceptance of the updated conditions. We recommend periodically checking this page.</p>
      </>
    ),
  },
  {
    num: '2',
    title: 'Service Description',
    content: (
      <>
        <p>Eye Web Reborn is a cybersecurity platform that offers:</p>
        <ul>
          <li><strong>Email verification</strong> against data breach databases, using the K-Anonymity model to protect user data.</li>
          <li><strong>Password security audit</strong> — local browser verification with SHA-256 hash comparison without transmitting the password.</li>
          <li><strong>URL and website security analysis</strong> — SSL certificates, threat history and suspicious link detection.</li>
          <li><strong>Traffic monitoring and threat detection</strong> — active defense system against abuse, scanners and automated attacks.</li>
          <li><strong>Support chatbot</strong> — intelligent assistant to guide users through the platform&apos;s features.</li>
        </ul>
      </>
    ),
  },
  {
    num: '3',
    title: 'Acceptable Use',
    content: (
      <>
        <p>The user agrees to respect the following usage conditions:</p>
        <ul>
          <li>Use the platform exclusively for legitimate personal security verification purposes.</li>
          <li>Not attempt to compromise, overload or attack the platform&apos;s services.</li>
          <li>Not use automated tools for scraping, crawling or API endpoint abuse.</li>
          <li>Only verify data that belongs to you or for which you have express authorization.</li>
          <li>Not share third-party verification results without prior consent.</li>
          <li>Not use the platform for illegal purposes, including attempting to access other users&apos; data.</li>
        </ul>
        <div className="legal-highlight">
          <i className="fa-solid fa-triangle-exclamation legal-highlight-icon"></i>
          <p>Failure to comply with these rules may result in immediate and permanent blocking of access to the platform.</p>
        </div>
      </>
    ),
  },
  {
    num: '4',
    title: 'Data Privacy and Security',
    content: (
      <>
        <p>The platform was built with the principle of <strong>privacy by design</strong>. We use the K-Anonymity model, ensuring that your personal data is never transmitted in clear text to our servers.</p>
        <p>Verified passwords never leave your browser. Email verification uses only a prefix of the SHA-256 hash, making it impossible to reconstruct the original address.</p>
        <p>For more details about the data we collect and how we protect it, please see our <a href="/politicas-privacidade">Privacy Policy</a>.</p>
      </>
    ),
  },
  {
    num: '5',
    title: 'Intellectual Property',
    content: (
      <>
        <p>All content, source code, design, logos and features of Eye Web Reborn are the property of its creators and are protected by copyright.</p>
        <p>Reproduction, modification, distribution or commercial use of any component of the platform without prior written authorization is prohibited.</p>
      </>
    ),
  },
  {
    num: '6',
    title: 'Limitation of Liability',
    content: (
      <>
        <p>Eye Web Reborn is provided &quot;as is&quot;. While we strive to maintain accurate and up-to-date information, we do not guarantee that verification results are 100% complete or current.</p>
        <p>The absence of results in a verification <strong>does not guarantee</strong> that the data has never been compromised. Results depend on the databases available at the time of the query.</p>
        <p>We are not responsible for direct, indirect, incidental or consequential damages resulting from the use or inability to use the platform.</p>
      </>
    ),
  },
  {
    num: '7',
    title: 'Access Blocking',
    content: (
      <>
        <p>We reserve the right to automatically block any IP or device that exhibits malicious behavior, including but not limited to:</p>
        <ul>
          <li>SQL injection or XSS attempts.</li>
          <li>Vulnerability scanning and aggressive fingerprinting.</li>
          <li>Brute force attacks against any endpoint.</li>
          <li>Excessive requests (DDoS) or rate limit abuse.</li>
          <li>Use of VPNs, proxies or Tor to evade previous blocks.</li>
        </ul>
        <div className="legal-highlight">
          <i className="fa-solid fa-shield-halved legal-highlight-icon"></i>
          <p>Blocks are applied automatically by the defense system and may be permanent in cases of recurrence.</p>
        </div>
      </>
    ),
  },
  {
    num: '8',
    title: 'Changes to Terms',
    content: (
      <>
        <p>We reserve the right to modify these Terms of Service at any time. Changes take effect immediately after publication on this page.</p>
        <p>Continued use of the platform after changes constitutes acceptance of the new conditions.</p>
        <p style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Last updated: February 2026</p>
      </>
    ),
  },
  {
    num: '9',
    title: 'Contact',
    content: (
      <>
        <p>For questions, inquiries or clarifications about these Terms of Service, you can contact us via email:{' '}
          <a href="https://outlook.live.com/mail/0/deeplink/compose?to=suporte@eyeweb.pt" target="_blank" rel="noopener noreferrer">suporte@eyeweb.pt</a>.
        </p>
      </>
    ),
  },
];

export default function TermosServicoPage() {
  const { lang } = useLanguage();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const SECTIONS = lang === 'en' ? SECTIONS_EN : SECTIONS_PT;
  const pageTitle = lang === 'en' ? 'Terms of Service' : 'Termos de Serviço';
  const tocTitle = lang === 'en' ? 'Table of Contents' : 'Índice';
  return (
    <>
      <Navbar />
      <div className="legal-page">
        {/* Hero */}
        <div className="legal-hero">
          <h1>{pageTitle}</h1>
        </div>

        {/* Table of Contents */}
        <div className="legal-toc">
          <h3>{tocTitle}</h3>
          <ol className="legal-toc-list">
            {SECTIONS.map((s) => (
              <li key={s.num}>
                <a href={`#section-${s.num}`}>
                  <span className="toc-num">{s.num}.</span> {s.title}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* Sections */}
        {SECTIONS.map((s) => (
          <div key={s.num} id={`section-${s.num}`} className="legal-section" style={{ animationDelay: `${0.05 * Number(s.num)}s` }}>
            <div className="legal-section-header">
              <div className="legal-section-num">{s.num}</div>
              <h2>{s.title}</h2>
            </div>
            {s.content}
          </div>
        ))}

      </div>
      <Footer />
      <style>{`html { scroll-behavior: smooth; }`}</style>
    </>
  );
}
