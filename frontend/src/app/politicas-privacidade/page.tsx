"use client";
import React, { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import '../legal.css';

const SECTIONS_PT = [
  {
    num: '1',
    title: 'Introdução',
    content: (
      <>
        <p>
          O Eye Web compromete-se a proteger a privacidade e os dados pessoais dos seus utilizadores.
          Esta Política de Privacidade descreve de forma transparente quais os dados que recolhemos, como
          os utilizamos, como os protegemos e quais os seus direitos enquanto utilizador.
        </p>
        <p>
          A plataforma foi construída com o princípio de <strong>privacidade por design</strong> (<em>privacy by design</em>),
          garantindo que a proteção de dados está integrada em cada componente do sistema desde a sua conceção.
        </p>
      </>
    ),
  },
  {
    num: '2',
    title: 'Dados que NÃO Recolhemos',
    content: (
      <>
        <p>
          O Eye Web foi concebido para <strong>minimizar a recolha de dados pessoais</strong>. Os seguintes
          dados nunca são transmitidos, armazenados ou processados nos nossos servidores:
        </p>
        <ul>
          <li>
            <strong>Endereços de e-mail verificados:</strong> A verificação utiliza o modelo K-Anonymity —
            apenas um prefixo do hash SHA-256 é transmitido, tornando impossível a reconstrução do e-mail original.
          </li>
          <li>
            <strong>Passwords:</strong> Nunca saem do seu navegador. A verificação de segurança é feita
            inteiramente no lado do cliente, comparando hashes locais com a API Have I Been Pwned.
          </li>
          <li>
            <strong>URLs verificados:</strong> São analisados de forma encriptada e os resultados são
            cacheados sem qualquer associação ao utilizador ou à sua sessão.
          </li>
          <li>
            <strong>Dados de formulários:</strong> Nenhuma informação introduzida nos campos de pesquisa
            é enviada para bases de dados internas ou de terceiros.
          </li>
        </ul>
        <div className="legal-highlight">
          <i className="fa-solid fa-shield-halved legal-highlight-icon"></i>
          <p>A sua password nunca é transmitida — nem parcialmente. Toda a verificação ocorre localmente no seu navegador.</p>
        </div>
      </>
    ),
  },
  {
    num: '3',
    title: 'Dados que Recolhemos',
    content: (
      <>
        <p>
          Para o funcionamento do sistema de monitorização de tráfego e segurança da plataforma,
          recolhemos os seguintes dados de forma automática:
        </p>
        <ul>
          <li>
            <strong>Endereço IP:</strong> Registado para deteção de ameaças, proteção contra ataques
            e bloqueio de acessos maliciosos. Os IPs são armazenados temporariamente e eliminados
            automaticamente no final de cada dia.
          </li>
          <li>
            <strong>Geolocalização aproximada:</strong> Apenas país e cidade, determinados a partir
            do IP público. Não utilizamos GPS ou geolocalização precisa.
          </li>
          <li>
            <strong>User-Agent:</strong> Para identificar o tipo de dispositivo, sistema operativo e
            navegador, essencial para detetar scanners automáticos e comportamento malicioso.
          </li>
          <li>
            <strong>Fingerprint do dispositivo:</strong> Hash anónimo (não reversível) para distinguir
            dispositivos e melhorar a precisão da deteção de ameaças.
          </li>
          <li>
            <strong>Páginas visitadas:</strong> Apenas o caminho (path) da página, sem parâmetros de
            query ou dados pessoais.
          </li>
          <li>
            <strong>Timestamp de acesso:</strong> Data e hora de cada visita para análise estatística
            e deteção de padrões de ataque.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: '4',
    title: 'Retenção e Eliminação de Dados',
    content: (
      <>
        <p>
          Os dados de tráfego e monitorização são <strong>eliminados automaticamente</strong> no final
          de cada dia (00:00 UTC). Antes da eliminação, é gerado um relatório estatístico agregado
          (sem dados pessoais identificáveis) que é conservado para análise de tendências.
        </p>
        <p>
          Os relatórios agregados contêm apenas métricas numéricas: número total de visitas, páginas
          mais visitadas, distribuição geográfica por país e tipos de dispositivo — sem qualquer
          informação que permita identificar um utilizador individual.
        </p>
      </>
    ),
  },
  {
    num: '5',
    title: 'Segurança dos Dados',
    content: (
      <>
        <p>Implementamos múltiplas camadas de proteção para garantir a segurança dos dados:</p>
        <ul>
          <li>
            <strong>HTTPS obrigatório:</strong> Todas as comunicações entre o navegador e os nossos
            servidores são encriptadas com TLS/SSL.
          </li>
          <li>
            <strong>Rate limiting:</strong> Limitação do número de pedidos por IP para prevenir abusos
            e ataques de força bruta.
          </li>
          <li>
            <strong>Deteção de scanners:</strong> Identificação e bloqueio automático de ferramentas
            de scanning de vulnerabilidades.
          </li>
          <li>
            <strong>Proteção contra injection:</strong> Sanitização rigorosa de todos os inputs
            para prevenir SQL injection, XSS e outros vetores de ataque.
          </li>
          <li>
            <strong>Bloqueio automático:</strong> IPs que apresentem comportamento malicioso
            são bloqueados automaticamente pelo sistema de defesa.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: '6',
    title: 'Cookies e Armazenamento Local',
    content: (
      <>
        <p>Utilizamos cookies de forma mínima e transparente:</p>
        <ul>
          <li>
            <strong>Cookies de sessão:</strong> Apenas para autenticação via Supabase Auth.
            São cookies essenciais e necessários para o funcionamento da área de administração.
          </li>
          <li>
            <strong>LocalStorage:</strong> Utilizado para preferências do utilizador (como tema
            e idioma) que permanecem exclusivamente no seu dispositivo.
          </li>
        </ul>
        <div className="legal-highlight">
          <i className="fa-solid fa-cookie-bite legal-highlight-icon"></i>
          <p>Não utilizamos cookies de rastreamento, analytics de terceiros, remarketing ou publicidade. Zero tracking.</p>
        </div>
      </>
    ),
  },
  {
    num: '7',
    title: 'Partilha com Terceiros',
    content: (
      <>
        <p>
          <strong>Não partilhamos, vendemos ou cedemos</strong> quaisquer dados pessoais a terceiros.
          Os únicos serviços externos utilizados são:
        </p>
        <ul>
          <li>
            <strong>Have I Been Pwned API:</strong> Para verificação de credenciais comprometidas.
            Apenas prefixos de hash SHA-256 são enviados (K-Anonymity).
          </li>
          <li>
            <strong>Supabase:</strong> Para autenticação e armazenamento de dados da plataforma,
            com encriptação em repouso e em trânsito.
          </li>
          <li>
            <strong>Geolocalização IP:</strong> Serviço externo para determinar país e cidade
            a partir do IP público, sem enviar dados pessoais adicionais.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: '8',
    title: 'Os Seus Direitos',
    content: (
      <>
        <p>
          De acordo com o Regulamento Geral sobre a Proteção de Dados (RGPD), enquanto utilizador tem
          o direito a:
        </p>
        <ul>
          <li><strong>Acesso:</strong> Solicitar informação sobre os dados que temos sobre si.</li>
          <li><strong>Retificação:</strong> Corrigir dados incorretos ou incompletos.</li>
          <li><strong>Eliminação:</strong> Solicitar a eliminação dos seus dados pessoais.</li>
          <li><strong>Portabilidade:</strong> Receber os seus dados em formato estruturado.</li>
          <li><strong>Oposição:</strong> Opor-se ao tratamento dos dados em determinadas circunstâncias.</li>
        </ul>
        <p>
          Para exercer qualquer um destes direitos, contacte-nos através do e-mail indicado abaixo.
          Responderemos no prazo de 30 dias.
        </p>
      </>
    ),
  },
  {
    num: '9',
    title: 'Alterações à Política',
    content: (
      <>
        <p>
          Esta Política de Privacidade pode ser atualizada periodicamente. Quaisquer alterações serão
          publicadas nesta página com a data de atualização correspondente. Recomendamos a consulta
          regular desta página.
        </p>
        <p style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
          Última atualização: Fevereiro 2026
        </p>
      </>
    ),
  },
  {
    num: '10',
    title: 'Contacto',
    content: (
      <>
        <p>
          Para questões, dúvidas ou exercício dos seus direitos de privacidade, pode contactar-nos em:{' '}
          <a href="https://outlook.live.com/mail/0/deeplink/compose?to=suporte@eyeweb.pt" target="_blank" rel="noopener noreferrer">suporte@eyeweb.pt</a>.
        </p>
      </>
    ),
  },
];

const SECTIONS_EN = [
  {
    num: '1',
    title: 'Introduction',
    content: (
      <>
        <p>Eye Web is committed to protecting the privacy and personal data of its users. This Privacy Policy transparently describes what data we collect, how we use it, how we protect it and what your rights are as a user.</p>
        <p>The platform was built with the principle of <strong>privacy by design</strong>, ensuring that data protection is integrated into every component of the system from its inception.</p>
      </>
    ),
  },
  {
    num: '2',
    title: 'Data We Do NOT Collect',
    content: (
      <>
        <p>Eye Web was designed to <strong>minimize personal data collection</strong>. The following data is never transmitted, stored or processed on our servers:</p>
        <ul>
          <li><strong>Verified email addresses:</strong> Verification uses the K-Anonymity model — only a SHA-256 hash prefix is transmitted, making it impossible to reconstruct the original email.</li>
          <li><strong>Passwords:</strong> Never leave your browser. Security verification is done entirely client-side, comparing local hashes with the Have I Been Pwned API.</li>
          <li><strong>Verified URLs:</strong> Analyzed in encrypted form and results are cached without any association to the user or their session.</li>
          <li><strong>Form data:</strong> No information entered in search fields is sent to internal or third-party databases.</li>
        </ul>
        <div className="legal-highlight">
          <i className="fa-solid fa-shield-halved legal-highlight-icon"></i>
          <p>Your password is never transmitted — not even partially. All verification occurs locally in your browser.</p>
        </div>
      </>
    ),
  },
  {
    num: '3',
    title: 'Data We Collect',
    content: (
      <>
        <p>For the operation of the traffic monitoring and platform security system, we automatically collect the following data:</p>
        <ul>
          <li><strong>IP Address:</strong> Registered for threat detection, attack protection and malicious access blocking. IPs are stored temporarily and automatically deleted at the end of each day.</li>
          <li><strong>Approximate geolocation:</strong> Country and city only, determined from the public IP. We do not use GPS or precise geolocation.</li>
          <li><strong>User-Agent:</strong> To identify device type, operating system and browser, essential for detecting automated scanners and malicious behavior.</li>
          <li><strong>Device fingerprint:</strong> Anonymous (non-reversible) hash to distinguish devices and improve threat detection accuracy.</li>
          <li><strong>Pages visited:</strong> Only the page path, without query parameters or personal data.</li>
          <li><strong>Access timestamp:</strong> Date and time of each visit for statistical analysis and attack pattern detection.</li>
        </ul>
      </>
    ),
  },
  {
    num: '4',
    title: 'Data Retention and Deletion',
    content: (
      <>
        <p>Traffic and monitoring data is <strong>automatically deleted</strong> at the end of each day (00:00 UTC). Before deletion, an aggregated statistical report (without personally identifiable data) is generated and kept for trend analysis.</p>
        <p>Aggregated reports contain only numerical metrics: total visits, most visited pages, geographic distribution by country and device types — without any information that would allow identification of an individual user.</p>
      </>
    ),
  },
  {
    num: '5',
    title: 'Data Security',
    content: (
      <>
        <p>We implement multiple layers of protection to ensure data security:</p>
        <ul>
          <li><strong>Mandatory HTTPS:</strong> All communications between the browser and our servers are encrypted with TLS/SSL.</li>
          <li><strong>Rate limiting:</strong> Limitation of requests per IP to prevent abuse and brute force attacks.</li>
          <li><strong>Scanner detection:</strong> Automatic identification and blocking of vulnerability scanning tools.</li>
          <li><strong>Injection protection:</strong> Rigorous sanitization of all inputs to prevent SQL injection, XSS and other attack vectors.</li>
          <li><strong>Automatic blocking:</strong> IPs exhibiting malicious behavior are automatically blocked by the defense system.</li>
        </ul>
      </>
    ),
  },
  {
    num: '6',
    title: 'Cookies and Local Storage',
    content: (
      <>
        <p>We use cookies minimally and transparently:</p>
        <ul>
          <li><strong>Session cookies:</strong> Only for authentication via Supabase Auth. These are essential cookies necessary for the administration area to function.</li>
          <li><strong>LocalStorage:</strong> Used for user preferences (such as theme and language) that remain exclusively on your device.</li>
        </ul>
        <div className="legal-highlight">
          <i className="fa-solid fa-cookie-bite legal-highlight-icon"></i>
          <p>We do not use tracking cookies, third-party analytics, remarketing or advertising. Zero tracking.</p>
        </div>
      </>
    ),
  },
  {
    num: '7',
    title: 'Third-Party Sharing',
    content: (
      <>
        <p><strong>We do not share, sell or transfer</strong> any personal data to third parties. The only external services used are:</p>
        <ul>
          <li><strong>Have I Been Pwned API:</strong> For compromised credential verification. Only SHA-256 hash prefixes are sent (K-Anonymity).</li>
          <li><strong>Supabase:</strong> For authentication and platform data storage, with encryption at rest and in transit.</li>
          <li><strong>IP Geolocation:</strong> External service to determine country and city from the public IP, without sending additional personal data.</li>
        </ul>
      </>
    ),
  },
  {
    num: '8',
    title: 'Your Rights',
    content: (
      <>
        <p>Under the General Data Protection Regulation (GDPR), as a user you have the right to:</p>
        <ul>
          <li><strong>Access:</strong> Request information about the data we hold about you.</li>
          <li><strong>Rectification:</strong> Correct incorrect or incomplete data.</li>
          <li><strong>Erasure:</strong> Request the deletion of your personal data.</li>
          <li><strong>Portability:</strong> Receive your data in a structured format.</li>
          <li><strong>Objection:</strong> Object to data processing under certain circumstances.</li>
        </ul>
        <p>To exercise any of these rights, contact us at the email address below. We will respond within 30 days.</p>
      </>
    ),
  },
  {
    num: '9',
    title: 'Changes to Policy',
    content: (
      <>
        <p>This Privacy Policy may be updated periodically. Any changes will be published on this page with the corresponding update date. We recommend regularly checking this page.</p>
        <p style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Last updated: February 2026</p>
      </>
    ),
  },
  {
    num: '10',
    title: 'Contact',
    content: (
      <>
        <p>For questions, inquiries or to exercise your privacy rights, you can contact us at:{' '}
          <a href="https://outlook.live.com/mail/0/deeplink/compose?to=suporte@eyeweb.pt" target="_blank" rel="noopener noreferrer">suporte@eyeweb.pt</a>.
        </p>
      </>
    ),
  },
];

export default function PoliticasPrivacidadePage() {
  const { lang } = useLanguage();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const SECTIONS = lang === 'en' ? SECTIONS_EN : SECTIONS_PT;
  const pageTitle = lang === 'en' ? 'Privacy Policy' : 'Políticas de Privacidade';
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
