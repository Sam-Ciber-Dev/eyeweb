import type { Metadata } from 'next'
import './globals.css'
import './login/login.css'
import './perfil/perfil.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import ChatWidget from '@/components/ChatWidget'
import PageTracker from '@/components/PageTracker'

export const metadata: Metadata = {
  title: 'Eye Web',
  description: 'Check if your personal data has been exposed in data breaches. Free cybersecurity tool with full privacy using K-Anonymity.',
  keywords: ['breach checker', 'data breach', 'cybersecurity', 'k-anonymity', 'email leak', 'password checker', 'url scanner', 'phone breach', 'data exposure', 'eye web'],
  authors: [{ name: 'Eye Web Team' }],
  creator: 'Eye Web',
  metadataBase: new URL('https://eyeweb.vercel.app'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'pt_PT',
    url: 'https://eyeweb.vercel.app',
    siteName: 'Eye Web',
    title: 'Eye Web',
    description: 'Check if your personal data has been exposed in data breaches. Free cybersecurity tool with full privacy using K-Anonymity.',
    images: [
      {
        url: '/social-preview.png',
        width: 1280,
        height: 640,
        alt: 'Eye Web — Data Breach & Cybersecurity Checker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Eye Web',
    description: 'Check if your personal data has been exposed in data breaches.',
    images: ['/social-preview.png'],
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
    <html lang="en">
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
