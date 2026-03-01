'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase, isAdminEmail } from '@/lib/supabase';

/**
 * Auth Callback — Client-Side
 * 
 * ESTRATÉGIA:
 * 1. Capturar flow/type da URL IMEDIATAMENTE (antes do Supabase limpar os params)
 * 2. Polling: esperar até que getSession() retorne uma sessão válida
 *    (o Supabase auto-processa o ?code= via detectSessionInUrl)
 * 3. Processar o user (verificar perfil, admin, etc.)
 */

// Capturar params da URL IMEDIATAMENTE quando o módulo carrega
// (antes de qualquer render ou effect)
const initialParams = typeof window !== 'undefined' 
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams();

const INITIAL_FLOW = initialParams.get('flow');
const INITIAL_TYPE = initialParams.get('type');

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    const flow = INITIAL_FLOW;
    const type = INITIAL_TYPE;

    console.log('Callback: Page loaded, flow=', flow, 'type=', type);

    const processUser = async (user: any) => {
      if (handledRef.current) return;
      handledRef.current = true;

      try {
        console.log('Callback: Processing user:', user.email);

        // ─── BLOQUEIO DE SEGURANÇA: Admins NÃO podem usar Google OAuth ───
        // Nota: usamos o param 'flow' (definido pelo signInWithGoogle) em vez de
        // app_metadata.provider, porque admins que criaram conta com email mantêm
        // provider='email' mesmo quando fazem OAuth via Google.
        if (user.email && (flow === 'login' || flow === 'signup')) {
          const adminCheck = await isAdminEmail(user.email);
          if (adminCheck) {
            await supabase.auth.signOut({ scope: 'local' });
            window.location.href = '/login?error=admin_google_blocked';
            return;
          }
        }

        // ─── GOOGLE OAuth: Verificar se completou o registo ───
        const isGoogleProvider = 
          user.app_metadata?.provider === 'google' ||
          user.identities?.some((i: any) => i.provider === 'google');

        if (isGoogleProvider) {
          const hasPassword = user.user_metadata?.has_password === true;
          const hasEmailIdentity = user.identities?.some(
            (i: any) => i.provider === 'email'
          );
          const hasCompletedSignup = hasPassword || hasEmailIdentity;

          // ─── SIGNUP JÁ COMPLETO ───
          if (hasCompletedSignup) {
            if (flow === 'signup') {
              // Já tem conta completa → redirecionar para login
              await supabase.auth.signOut({ scope: 'local' });
              window.location.href = '/login?error=account_exists';
              return;
            }
            // Login com conta completa → home
            console.log('Callback: Completed Google user → home');
            sessionStorage.setItem('eyeweb_intro_seen', 'true');
            window.location.href = '/';
            return;
          }

          // ─── SIGNUP NÃO COMPLETO: Limpar TUDO e redirecionar ───
          // Regra: NADA fica na base de dados até o signup ser completo.
          // Tanto para flow=login como flow=signup.
          const googleName = user.user_metadata?.full_name || user.user_metadata?.name || '';
          const googleEmail = user.email || '';
          const userId = user.id;

          // 1. SignOut LOCAL (sem server call — evita 403 e race conditions)
          await supabase.auth.signOut({ scope: 'local' });
          console.log('Callback: Signed out locally');

          // 2. Esperar que React processe SIGNED_OUT e unsubscribe realtime channels
          await new Promise(r => setTimeout(r, 300));

          // 3. Cleanup: apagar user/profile do auth.users (via backend com service_role)
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          try {
            const resp = await fetch(`${apiUrl}/api/v1/auth/cleanup-google-user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId }),
            });
            const result = await resp.json();
            console.log('Callback: Cleanup result:', result.message);
          } catch (cleanupErr) {
            console.warn('Callback: Cleanup failed (non-critical):', cleanupErr);
          }

          // 4. Redirecionar para signup com dados pré-preenchidos
          const params = new URLSearchParams({ from: 'google' });
          if (flow === 'login') {
            params.set('error', 'no_signup');
          } else {
            params.set('notice', 'google_signup');
          }
          if (googleName) params.set('name', googleName);
          if (googleEmail) params.set('email', googleEmail);
          console.log('Callback: Redirect to signup');
          window.location.href = `/signup?${params.toString()}`;
          return;
        }

        // ─── MAGIC LINK ───
        if (type === 'magiclink') {
          window.location.href = '/auth/login-success';
          return;
        }

        // ─── TUDO OK → Home page (skip eye intro) ───
        console.log('Callback: All good → redirect to home');
        sessionStorage.setItem('eyeweb_intro_seen', 'true');
        window.location.href = '/';
      } catch (err) {
        console.error('Callback processing error:', err);
        setStatus('error');
        window.location.href = '/login?error=auth_failed';
      }
    };

    // ─── POLLING: esperar pela sessão ───
    // O Supabase detectSessionInUrl processa o ?code= automaticamente.
    // Fazemos polling a cada 200ms até que getSession retorne sessão válida.
    let pollCount = 0;
    const maxPolls = 25; // 25 * 200ms = 5 segundos máximo
    
    const pollForSession = async () => {
      pollCount++;
      console.log(`Callback: Poll #${pollCount} for session...`);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('Callback: Session found!');
          clearInterval(pollInterval);
          processUser(session.user);
          return;
        }
        
        if (pollCount >= maxPolls) {
          console.error('Callback: No session after', maxPolls, 'polls');
          clearInterval(pollInterval);
          if (!handledRef.current) {
            handledRef.current = true;
            window.location.href = '/login?error=auth_failed';
          }
        }
      } catch (err) {
        console.error('Callback: Poll error:', err);
      }
    };

    // Primeiro poll imediato, depois a cada 200ms
    pollForSession();
    const pollInterval = setInterval(pollForSession, 200);

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      color: 'white',
      background: '#0a0a0a',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {status === 'loading' ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTop: '3px solid #ef4444',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p>Processing authentication...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <p>Authentication error. Redirecting...</p>
      )}
    </div>
  );
}
