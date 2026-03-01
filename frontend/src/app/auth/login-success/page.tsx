'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import './login-success.css';

export default function LoginSuccessPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [countdown, setCountdown] = useState(5);

  // Countdown para redirecionar
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Usar window.location para garantir reload completo
      // Isto assegura que o AuthContext é reinicializado corretamente
      window.location.href = '/';
    }
  }, [countdown]);

  // Se não estiver autenticado, redirecionar para login
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="success-container">
        <div className="success-loading">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="success-container">
      <div className="success-card">
        {/* Ícone de sucesso animado */}
        <div className="success-icon">
          <div className="success-checkmark">
            <i className="fa-solid fa-check"></i>
          </div>
        </div>

        {/* Mensagem */}
        <h1>Login successful!</h1>
        <p className="success-welcome">
          Welcome back, <strong>{user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'user'}</strong>!
        </p>

        {/* Info de redirecionamento */}
        <div className="success-redirect-info">
          <i className="fa-solid fa-clock"></i>
          <span>Redirecting in {countdown} seconds...</span>
        </div>

        {/* Barra de progresso */}
        <div className="success-progress-bar">
          <div 
            className="success-progress-fill" 
            style={{ width: `${((5 - countdown) / 5) * 100}%` }}
          ></div>
        </div>

        {/* Link manual */}
        <div className="success-manual-link">
          <a href="/" onClick={(e) => { e.preventDefault(); window.location.href = '/'; }}>
            <i className="fa-solid fa-home"></i>
            Ir para a página inicial agora
          </a>
        </div>

        {/* Nota de segurança */}
        <div className="success-security-note">
          <i className="fa-solid fa-shield-check"></i>
          <span>A tua sessão está protegida com encriptação de ponta a ponta</span>
        </div>
      </div>
    </div>
  );
}
