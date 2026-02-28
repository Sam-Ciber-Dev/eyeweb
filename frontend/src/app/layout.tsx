import type { Metadata } from 'next'
import './globals.css'
import './login/login.css'
import './perfil/perfil.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import ChatWidget from '@/components/ChatWidget'
import PageTracker from '@/components/PageTracker'

export const metadata: Metadata = {
  title: {
    default: 'Eye Web — Data Breach & Cybersecurity Checker',
    template: '%s | Eye Web',
  },
  description: 'Check if your personal data has been exposed in data breaches. Free cybersecurity tool with full privacy using K-Anonymity. Verify emails, passwords, URLs and phone numbers.',
  keywords: ['breach checker', 'data breach', 'cybersecurity', 'k-anonymity', 'email leak', 'password checker', 'url scanner', 'phone breach', 'data exposure', 'eye web'],
  authors: [{ name: 'Eye Web Team' }],
  creator: 'Eye Web',
  metadataBase: new URL('https://eyeweb.vercel.app'),
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    alternateLocale: 'en_US',
    url: 'https://eyeweb.vercel.app',
    siteName: 'Eye Web',
    title: 'Eye Web — Data Breach & Cybersecurity Checker',
    description: 'Check if your personal data has been exposed in data breaches. Free cybersecurity tool with full privacy using K-Anonymity.',
  },
  twitter: {
    card: 'summary',
    title: 'Eye Web — Data Breach & Cybersecurity Checker',
    description: 'Check if your personal data has been exposed in data breaches.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt">
      <head>
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" 
        />
        {/* Pré-carregar script do Cloudflare Turnstile para reduzir tempo de loading */}
        <link 
          rel="preconnect" 
          href="https://challenges.cloudflare.com" 
        />
        <link 
          rel="dns-prefetch" 
          href="https://challenges.cloudflare.com" 
        />
      </head>
      <body>
        <LanguageProvider>
          <AuthProvider>
            <PageTracker />
            {children}
            <ChatWidget />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
