import type { Metadata } from 'next'
import './globals.css'
import './login/login.css'
import './perfil/perfil.css'
import { AuthProvider } from '@/contexts/AuthContext'
import ChatWidget from '@/components/ChatWidget'
import PageTracker from '@/components/PageTracker'

export const metadata: Metadata = {
  title: 'Eye Web',
  description: 'Verifique se os seus dados foram expostos em fugas de dados. Ferramenta de cibersegurança com privacidade total usando K-Anonymity.',
  keywords: ['breach checker', 'data breach', 'cybersecurity', 'k-anonymity', 'email leak'],
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
        <AuthProvider>
          <PageTracker />
          {children}
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  )
}
