'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { t } = useLanguage();

  return (
    <footer className="site-footer-minimal">
      <div className="footer-minimal-content">
        <div className="footer-minimal-links">
          <Link href="/politicas-privacidade">{t('footer.privacy')}</Link>
          <span className="footer-divider">|</span>
          <Link href="/termos-servico">{t('footer.terms')}</Link>
          <span className="footer-divider">|</span>
          <a href="https://outlook.live.com/mail/0/deeplink/compose?to=suporte@eyeweb.pt" target="_blank" rel="noopener noreferrer">suporte@eyeweb.pt</a>
        </div>
        <div className="footer-minimal-info">
          <span>© {currentYear} Eye Web</span>
          <span className="footer-divider">·</span>
          <span>{t('footer.privacyGuarantee')} <a href="https://haveibeenpwned.com/API/v3#SearchingPwnedPasswordsByRange" target="_blank" rel="noopener noreferrer" className="k-anonymity-link">K-Anonymity</a></span>
        </div>
      </div>
    </footer>
  );
}
