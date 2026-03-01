'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { 
  supabase, 
  Profile, 
  getProfile, 
  signInWithEmail, 
  signInWithGoogle,
  signUpWithEmail,
  signOut as supabaseSignOut,
  isAdminEmail 
} from '@/lib/supabase';

// ===========================================
// TIPOS
// ===========================================

interface AuthContextType {
  // Estado
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  
  // Funções de auth
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signupWithGoogle: () => Promise<void>;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Helpers
  isAuthenticated: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

// ===========================================
// CONTEXT
// ===========================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===========================================
// PROVIDER
// ===========================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Ref para o ID do user atual (acessível em closures sem stale state)
  const userIdRef = useRef<string | null>(null);

  // Enviar email de boas-vindas (apenas uma vez por utilizador)
  const sendWelcomeEmail = async (email: string, displayName: string | null) => {
    try {
      // Verificar se já foi enviado (usando localStorage)
      const welcomeSentKey = `welcome_sent_${email}`;
      if (localStorage.getItem(welcomeSentKey)) {
        return; // Já foi enviado
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/admin/emails/welcome?email=${encodeURIComponent(email)}&display_name=${encodeURIComponent(displayName || '')}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        localStorage.setItem(welcomeSentKey, 'true');
        console.log('✅ Email de boas-vindas enviado!');
      }
    } catch (error) {
      console.error('Erro ao enviar email de boas-vindas:', error);
    }
  };

  // Carregar perfil do utilizador
  const loadProfile = async (userId: string) => {
    try {
      const userProfile = await getProfile(userId);
      
      // Se o perfil não existe, verificar se o signup foi completado
      if (!userProfile) {
        // Obter dados do utilizador atual
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (currentUser) {
          // GUARD: Só auto-criar perfil se o utilizador completou o signup
          // Google-only users sem password NÃO devem ter perfil auto-criado
          const hasCompletedSignup = 
            currentUser.user_metadata?.has_password === true ||
            currentUser.identities?.some((i: any) => i.provider === 'email');
          
          if (!hasCompletedSignup) {
            console.warn('User has not completed signup - skipping profile creation');
            return;
          }
          
          console.warn('Profile not found - creating basic profile');
          
          // Verificar se é admin (async)
          const userIsAdmin = await isAdminEmail(currentUser.email || '');
          
          // Criar perfil básico
          const newProfile = {
            id: currentUser.id,
            email: currentUser.email,
            display_name: currentUser.user_metadata?.display_name || 
                         currentUser.user_metadata?.full_name || 
                         currentUser.email?.split('@')[0],
            avatar_url: currentUser.user_metadata?.avatar_url,
            role: userIsAdmin ? 'admin' : 'user',
          };
          
          const { data, error } = await supabase
            .from('profiles')
            .upsert(newProfile)
            .select()
            .single();
          
          if (error) {
            console.error('Error creating profile:', error);
            return;
          }
          
          setProfile(data);
          
          // Enviar email de boas-vindas para novos utilizadores (não admin)
          if (data.email && !userIsAdmin) {
            sendWelcomeEmail(data.email, data.display_name);
          }
          
          return;
        }
        return;
      }
      
      setProfile(userProfile);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Refrescar perfil
  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  // Inicializar auth state
  // ESTRATÉGIA DE CORRIDA: usa getSession() E onAuthStateChange em paralelo.
  // O primeiro que resolver ganha. Em produção no Vercel, ambos podem ser lentos
  // individualmente, mas juntos um deles chega rápido.
  useEffect(() => {
    let isMounted = true;
    let authResolved = false; // Flag para evitar processar 2x
    
    // Resolver auth state (chamado por quem chegar primeiro)
    // CRITICAL: Set loading=false IMEDIATAMENTE, carregar profile em background.
    // Se bloquearmos em loadProfile, loading fica preso 8-15s no Vercel.
    const resolveAuth = (session: any, source: string) => {
      if (authResolved || !isMounted) return;
      authResolved = true;
      
      console.log(`✅ Auth resolved via ${source}`);
      
      setSession(session);
      setUser(session?.user ?? null);
      userIdRef.current = session?.user?.id ?? null;
      
      // CRITICAL: loading=false PRIMEIRO — NÃO esperar pelo profile
      if (isMounted) setLoading(false);
      
      // Profile carrega em background (não bloqueia loading)
      if (session?.user) {
        loadProfile(session.user.id).catch(err => {
          console.error('Error loading profile:', err);
        });
      }
    };
    
    // Safety timeout - garantir que loading NUNCA fica preso
    const safetyTimeout = setTimeout(() => {
      if (!authResolved && isMounted) {
        console.error('⚠️ AuthContext safety timeout: forcing loading=false');
        authResolved = true;
        setLoading(false);
      }
    }, 8000);

    // ESTRATÉGIA 1: getSession() — faz chamada async, mas funciona sempre
    const initFromGetSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('getSession error:', error);
          if (error.message?.includes('Refresh Token') || error.message?.includes('Invalid')) {
            await supabase.auth.signOut({ scope: 'local' });
          }
          if (!authResolved && isMounted) {
            authResolved = true;
            setLoading(false);
          }
          return;
        }
        
        resolveAuth(session, 'getSession');
      } catch (err) {
        console.error('getSession exception:', err);
        if (!authResolved && isMounted) {
          authResolved = true;
          setLoading(false);
        }
      }
    };
    
    initFromGetSession();

    // ESTRATÉGIA 2: onAuthStateChange — inclui INITIAL_SESSION + eventos futuros
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        
        if (!isMounted) return;
        
        // INITIAL_SESSION: sessão do localStorage (pode ser instantâneo ou lento)
        if (event === 'INITIAL_SESSION') {
          resolveAuth(session, 'INITIAL_SESSION');
          return;
        }
        
        // TOKEN_REFRESHED só renova o JWT - os dados do perfil não mudam
        if (event === 'TOKEN_REFRESHED') {
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }
        
        // SIGNED_OUT explícito - limpar tudo
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          userIdRef.current = null;
          setLoading(false);
          return;
        }
        
        // SIGNED_IN: usar resolveAuth se ainda não resolvido (resolve loading instantaneamente)
        if (event === 'SIGNED_IN') {
          // Primeiro SIGNED_IN (login real) — resolver loading + carregar profile em bg
          if (!authResolved) {
            resolveAuth(session, 'SIGNED_IN');
            return;
          }
          // Mesmo user (BroadcastChannel sync entre tabs) — só atualizar session
          if (session?.user?.id === userIdRef.current) {
            setSession(session);
            return;
          }
          // User diferente — atualizar tudo
          setSession(session);
          setUser(session?.user ?? null);
          userIdRef.current = session?.user?.id ?? null;
          setLoading(false);
          if (session?.user) {
            loadProfile(session.user.id).catch(err => console.error(err));
          }
          return;
        }
        
        // Outros eventos (USER_UPDATED, etc.)
        setSession(session);
        setUser(session?.user ?? null);
        userIdRef.current = session?.user?.id ?? null;
        
        if (session?.user) {
          loadProfile(session.user.id).catch(err => console.error(err));
        }
        
        if (isMounted) setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Listener para detetar quando o perfil é eliminado (realtime)
  useEffect(() => {
    if (!user) return;

    // Subscrever a mudanças na tabela profiles para este utilizador
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async () => {
          // Se estamos na página de callback, não interferir com redirects
          if (typeof window !== 'undefined' && window.location.pathname.includes('/auth/callback')) {
            console.log('Profile deleted - but on callback page, skipping redirect');
            return;
          }
          console.log('Profile deleted - logging out');
          await supabaseSignOut();
          setUser(null);
          setProfile(null);
          setSession(null);
          // Redirecionar para login
          if (typeof window !== 'undefined') {
            window.location.href = '/login?reason=account_deleted';
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // ===========================================
  // FUNÇÕES DE AUTH
  // ===========================================

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { user: authUser } = await signInWithEmail(email, password);
      
      if (authUser) {
        setUser(authUser);
        await loadProfile(authUser.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    // O redirect é handled pelo Supabase — flow='login'
    await signInWithGoogle('login');
  };

  const signupWithGoogle = async () => {
    // O redirect é handled pelo Supabase — flow='signup'
    await signInWithGoogle('signup');
  };

  const signup = async (email: string, password: string, fullName?: string) => {
    setLoading(true);
    try {
      // Verificar se é email de admin (não pode registar via signup normal)
      const emailIsAdmin = await isAdminEmail(email);
      if (emailIsAdmin) {
        throw new Error('Este email não pode ser registado. Contacte o administrador.');
      }
      
      await signUpWithEmail(email, password, fullName);
      // O utilizador precisa confirmar o email antes de fazer login
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Limpar MFA verificado (segurança: limpar antes de tudo)
      localStorage.removeItem('mfa_verified');
      await supabaseSignOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      // Redirecionar para home após logout (usar window.location para garantir reload completo)
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Mesmo com erro, limpar estado local e redirecionar
      localStorage.removeItem('mfa_verified');
      setUser(null);
      setProfile(null);
      setSession(null);
      window.location.href = '/';
    }
  };

  // ===========================================
  // VALORES DO CONTEXT
  // ===========================================

  // Um user só é "autenticado" se completou o signup.
  // Google-only users sem password NÃO são considerados autenticados
  // (precisam da sessão técnica para completar o signup, mas não devem
  // ver UI de "logged in" como navbar com nome/avatar).
  const hasCompletedSignup = !!user && (
    user.user_metadata?.has_password === true ||
    user.identities?.some((i: any) => i.provider === 'email') ||
    false
  );

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    login,
    loginWithGoogle,
    signupWithGoogle,
    signup,
    logout,
    isAuthenticated: hasCompletedSignup,
    isAdmin: profile?.role === 'admin',
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ===========================================
// HOOK
// ===========================================

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// ===========================================
// HOC PARA PROTEGER ROTAS
// ===========================================

export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: { requireAdmin?: boolean }
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isAdmin, loading } = useAuth();
    
    if (loading) {
      return (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      );
    }
    
    if (!isAuthenticated) {
      // Redirecionar para login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }
    
    if (options?.requireAdmin && !isAdmin) {
      // Redirecionar para home se não for admin
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      return null;
    }
    
    return <WrappedComponent {...props} />;
  };
}
