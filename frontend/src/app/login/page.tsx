'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { isAdminEmail, supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { motion, AnimatePresence } from 'framer-motion';
import './login.css';

type LoginStep = 'credentials' | 'verification' | 'forgot-email' | 'forgot-code' | 'forgot-newpass';

interface PasswordStrength {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

// Wrapper component para envolver com Suspense
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-container">
        <div className="auth-loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithGoogle, isAuthenticated, isAdmin, loading } = useAuth();
  const { t } = useLanguage();
  
  // Estado do passo atual
  const [step, setStep] = useState<LoginStep>('credentials');
  
  // Credenciais
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Verificação com código OTP
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Estados gerais
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  
  // Turnstile captcha
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  
  // Forgot Password states
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showLoginError, setShowLoginError] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false); // Flag para ignorar auth redirect durante recovery
  const [recoverySession, setRecoverySession] = useState<{access_token: string, refresh_token: string} | null>(null); // Sessão temporária para update password
  
  // Password strength for new password
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
  });

  // Animation direction (1 = forward, -1 = backward)
  const [direction, setDirection] = useState(1);
  const [codeSent, setCodeSent] = useState(false);

  // Animation variants
  const pageVariants = {
    initial: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 100 : -100,
    }),
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -100 : 100,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    }),
  };

  const fadeInVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' as const }
    },
  };

  const emailSentVariants = {
    initial: { scale: 0, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: { 
        type: 'spring' as const,
        stiffness: 200,
        damping: 15,
        delay: 0.2
      }
    },
  };

  const pulseVariants = {
    animate: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut' as const,
      },
    },
  };
  
  // Validate new password strength
  useEffect(() => {
    setPasswordStrength({
      hasMinLength: newPassword.length >= 8,
      hasUppercase: /[A-Z]/.test(newPassword),
      hasLowercase: /[a-z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
    });
  }, [newPassword]);
  
  const isPasswordValid = () => {
    return Object.values(passwordStrength).every(Boolean);
  };

  // Verificar erros na URL (ex: admin tentou usar Google)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'admin_google_blocked') {
      setError(t('login.adminGoogleBlocked'));
    } else if (errorParam === 'account_banned') {
      setError(t('login.suspended'));
    } else if (errorParam === 'auth_failed') {
      setError(t('login.authError'));
    } else if (errorParam === 'no_account') {
      setError(t('login.googleNotRegistered'));
    } else if (errorParam === 'account_exists') {
      setError(t('login.googleAlreadyRegistered'));
    }
  }, [searchParams]);

  // Redirecionar se já autenticado (mas NÃO durante o recovery mode)
  useEffect(() => {
    if (isAuthenticated && !loading && !isRecoveryMode) {
      if (isAdmin) {
        router.push('/admin');
      } else {
        router.push('/');
      }
    }
  }, [isAuthenticated, isAdmin, loading, router, isRecoveryMode]);

  // Detectar se é email de admin (com debounce para não fazer muitas queries)
  useEffect(() => {
    // Só verificar se o email parece completo (tem @ e domínio)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email || !emailRegex.test(email)) {
      setIsAdminLogin(false);
      return;
    }
    
    // Debounce de 500ms para não fazer query a cada tecla
    const timeoutId = setTimeout(async () => {
      try {
        const result = await isAdminEmail(email);
        setIsAdminLogin(result);
      } catch {
        setIsAdminLogin(false);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [email]);

  // Cooldown para reenviar código
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Escutar quando o utilizador volta do magic link
  useEffect(() => {
    if (step !== 'verification') return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Login verificado via magic link!
        window.location.href = '/';
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [step]);

  // Estado para mostrar mensagem de conta não existente
  const [showNoAccountError, setShowNoAccountError] = useState(false);

  // Passo 1: Validar credenciais e enviar código OTP
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowLoginError(false);
    setShowNoAccountError(false);
    setSuccessMessage(null);

    // Verificar se temos token do captcha (frontend-only)
    if (!captchaToken) {
      setError(t('login.completeSecurity'));
      return;
    }

    setIsLoading(true);
    
    // Reset captcha (já validámos visualmente)
    turnstileRef.current?.reset();
    setCaptchaToken(null);

    try {
      // Primeiro validar credenciais com um cliente temporário (não cria sessão)
      const { createClient } = await import('@supabase/supabase-js');
      const tempClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      );
      
      const { data: signInData, error: credError } = await tempClient.auth.signInWithPassword({ 
        email, 
        password
      });
      
      // DEBUG: Ver erro real do Supabase
      console.log('Supabase signIn response:', { data: signInData, error: credError });
      
      if (credError) {
        console.error('Supabase Auth Error Details:', {
          message: credError.message,
          status: credError.status,
          name: credError.name,
          cause: credError.cause
        });
        // Verificar se o email existe usando RPC function (bypass RLS)
        const { data: emailExists } = await supabase.rpc('check_email_exists', {
          p_email: email
        });
        
        if (emailExists) {
          // O email existe mas as credenciais estão erradas
          setShowLoginError(true);
          throw new Error(t('login.wrongCredentials'));
        } else {
          // Email não existe de todo
          setShowNoAccountError(true);
          setIsLoading(false);
          return;
        }
      }
      
      // Credenciais válidas - fazer logout do cliente temporário
      await tempClient.auth.signOut();
      
      // Debug: verificar se é admin
      console.log('Email:', email);
      console.log('isAdminLogin state:', isAdminLogin);
      
      // Se é admin, redirecionar para MFA em vez de enviar OTP por email
      // Usar verificação direta em vez do state (mais fiável)
      const isAdmin = await isAdminEmail(email);
      console.log('isAdminEmail result:', isAdmin);
      if (isAdmin) {
        console.log('Admin detectado! A redirecionar para MFA...');
        // Guardar email no sessionStorage para a página MFA
        sessionStorage.setItem('admin_pending_email', email);
        sessionStorage.setItem('admin_pending_password', password);
        // Usar window.location para redirecionamento mais fiável
        window.location.href = '/admin/mfa';
        return;
      }
      
      // Utilizador normal - enviar código OTP via email
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });
      
      if (otpError) throw otpError;
      
      // Ir para o passo de verificação
      setDirection(1);
      setCodeSent(true);
      setStep('verification');
      setResendCooldown(60);
      setOtpCode('');
      
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message?.includes('rate limit')) {
        setError(t('login.tooManyEmails'));
      } else {
        setError(err.message || t('login.loginError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Passo 2: Verificar código OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpCode.length !== 6) {
      setError(t('login.code6digits'));
      return;
    }
    
    setError(null);
    setIsLoading(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      });
      
      if (verifyError) {
        if (verifyError.message.includes('Token has expired')) {
          throw new Error(t('login.codeExpired'));
        }
        throw new Error(t('login.codeIncorrect'));
      }
      
      // Login completo! Redirecionar
      window.location.href = '/';
      
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      setError(err.message || t('login.codeWrong'));
      setIsLoading(false);
    }
  };

  // Reenviar código
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { 
          shouldCreateUser: false,
          captchaToken: captchaToken || undefined,
        },
      });
      
      // Reset captcha
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      
      if (error) throw error;
      
      setResendCooldown(60);
      setOtpCode('');
    } catch (err: any) {
      setError(t('login.resendError'));
    } finally {
      setIsLoading(false);
    }
  };

  // Voltar para credenciais
  const handleBackToCredentials = async () => {
    // Limpar qualquer sessão e token de recovery
    await supabase.auth.signOut();
    setDirection(-1);
    setCodeSent(false);
    setIsRecoveryMode(false);
    setRecoverySession(null);
    setStep('credentials');
    setError(null);
    setOtpCode('');
    setShowLoginError(false);
    setShowNoAccountError(false);
    setSuccessMessage(null);
  };

  // ==========================================
  // FORGOT PASSWORD HANDLERS
  // ==========================================

  // Iniciar processo de recuperação
  const handleForgotPassword = async () => {
    // Limpar qualquer sessão existente primeiro
    await supabase.auth.signOut();
    setDirection(1);
    setStep('forgot-email');
    setError(null);
    setForgotEmail(email || ''); // Pré-preencher com email do login se existir
    setShowLoginError(false);
    setShowNoAccountError(false);
    setIsRecoveryMode(true);
  };

  // Criar cliente Supabase temporário SEM persistência de sessão
  const createTempClient = async () => {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { 
        auth: { 
          persistSession: false, 
          autoRefreshToken: false, 
          detectSessionInUrl: false 
        } 
      }
    );
  };

  // Enviar código de recuperação para o email
  const handleSendRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Verificar se temos token do captcha (frontend-only)
    if (!captchaToken) {
      setError(t('login.completeSecurity'));
      return;
    }

    setIsLoading(true);
    
    // Reset captcha (já validámos visualmente)
    turnstileRef.current?.reset();
    setCaptchaToken(null);

    try {
      // Validar email
      if (!forgotEmail || !forgotEmail.includes('@')) {
        throw new Error(t('login.invalidEmail'));
      }
      
      // Enviar código de recuperação via Supabase
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail);

      if (resetError) {
        console.error('Reset error details:', resetError);
        throw resetError;
      }

      // Avançar para o passo do código
      setDirection(1);
      setCodeSent(true);
      setStep('forgot-code');
      setResendCooldown(60);
      setForgotCode('');

    } catch (err: any) {
      console.error('Recovery email error:', err);
      setError(err.message || t('login.recoveryEmailError'));
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar código de recuperação
  const handleVerifyRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (forgotCode.length !== 6) {
      setError('O código deve ter 6 dígitos.');
      return;
    }
    
    setError(null);
    setIsLoading(true);

    try {
      // Usar cliente temporário para verificar o código SEM criar sessão persistente
      const tempClient = await createTempClient();
      
      // Verificar o código OTP de recuperação
      const { data, error: verifyError } = await tempClient.auth.verifyOtp({
        email: forgotEmail,
        token: forgotCode,
        type: 'recovery',
      });

      if (verifyError) {
        if (verifyError.message.includes('Token has expired')) {
          throw new Error(t('login.codeExpired'));
        }
        throw new Error(t('login.codeIncorrectVerify'));
      }

      // Guardar a sessão completa para poder atualizar a password
      if (data.session?.access_token && data.session?.refresh_token) {
        setRecoverySession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      } else {
        throw new Error(t('login.recoveryTokenError'));
      }

      // Código válido! A sessão só existe no cliente temporário (não persistida)
      // Avançar para o passo de criar nova password
      setDirection(1);
      setStep('forgot-newpass');
      setNewPassword('');
      setConfirmNewPassword('');

    } catch (err: any) {
      console.error('Verify recovery code error:', err);
      setError(err.message || t('login.codeWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  // Definir nova password
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações
    if (!isPasswordValid()) {
      setError(t('login.passwordRequirements'));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(t('login.passwordMismatch'));
      return;
    }

    if (!recoverySession) {
      setError(t('login.recoveryExpired'));
      setStep('forgot-email');
      return;
    }

    setIsLoading(true);

    try {
      // Criar cliente temporário com a sessão de recovery
      const tempClient = await createTempClient();
      
      // Definir a sessão completa com os tokens de recovery
      const { error: sessionError } = await tempClient.auth.setSession({
        access_token: recoverySession.access_token,
        refresh_token: recoverySession.refresh_token,
      });
      
      if (sessionError) throw sessionError;
      
      // Atualizar a password usando o cliente temporário
      const { error: updateError } = await tempClient.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Limpar qualquer sessão do cliente principal (por segurança)
      await supabase.auth.signOut();
      
      // Limpar estados de recovery
      setIsRecoveryMode(false);
      setRecoverySession(null);

      // Voltar ao login com mensagem de sucesso
      setStep('credentials');
      setSuccessMessage(t('login.passwordChanged'));
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setForgotCode('');
      setForgotEmail('');

    } catch (err: any) {
      console.error('Update password error:', err);
      setError(err.message || t('login.passwordUpdateError'));
    } finally {
      setIsLoading(false);
    }
  };

  // Reenviar código de recuperação
  const handleResendRecoveryCode = async () => {
    if (resendCooldown > 0) return;
    
    setError(null);
    setIsLoading(true);

    try {
      // Usar cliente temporário
      const tempClient = await createTempClient();
      const { error: resetError } = await tempClient.auth.resetPasswordForEmail(forgotEmail);

      if (resetError) throw resetError;

      setResendCooldown(60);
      setForgotCode('');
    } catch (err: any) {
      setError(t('login.resendError'));
    } finally {
      setIsLoading(false);
    }
  };

  // Voltar ao passo anterior no forgot password
  const handleBackFromForgot = async () => {
    // Limpar sessão e token de recovery
    await supabase.auth.signOut();
    setRecoverySession(null);
    setDirection(-1);
    setCodeSent(false);
    
    if (step === 'forgot-code') {
      setStep('forgot-email');
    } else if (step === 'forgot-newpass') {
      setStep('forgot-code');
    } else {
      setStep('credentials');
      setIsRecoveryMode(false);
    }
    setError(null);
  };

  const handleGoogleLogin = async () => {
    if (isAdminLogin) {
      setError(t('login.adminManualOnly'));
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(err.message || t('login.googleError'));
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-loading">
          <div className="spinner"></div>
          <p>{t('login.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="auth-container">
        <motion.div 
          className="auth-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Back Arrow */}
          <Link href="/" className="auth-back-arrow">
            <i className="fa-solid fa-arrow-left"></i>
          </Link>
          
          {/* Header */}
          <div className="auth-header">
            <Link href="/" className="auth-logo">
              <i className="fa-solid fa-eye"></i>
              <span>Eye Web</span>
            </Link>
          
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {step === 'credentials' ? (
                <>
                  <h1>Login</h1>
                </>
              ) : step === 'verification' ? (
                <>
                  <h1>{t('login.securityVerification')}</h1>
                  <p>{t('login.confirmLogin')}</p>
                </>
              ) : step === 'forgot-email' ? (
                <>
                  <h1>{t('login.recoverPassword')}</h1>
                  <p>{t('login.enterEmailForCode')}</p>
                </>
              ) : step === 'forgot-code' ? (
                <>
                  <h1>{t('login.verifyCode')}</h1>
                  <p>{t('login.enterCodeSent')}</p>
                </>
              ) : (
                <>
                  <h1>{t('login.newPassword')}</h1>
                  <p>{t('login.createNewPassword')}</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mensagem de sucesso */}
        {successMessage && step === 'credentials' && (
          <motion.div 
            className="auth-success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <i className="fa-solid fa-circle-check"></i>
            <span>{successMessage}</span>
          </motion.div>
        )}

        <AnimatePresence mode="wait" custom={direction}>
        {/* Passo 1: Credenciais */}
        {step === 'credentials' && (
          <motion.div
            key="credentials"
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <form onSubmit={handleCredentialsSubmit} className="auth-form">
              {/* Email */}
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-envelope"></i>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-lock"></i>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="auth-error">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{error}</span>
                </div>
              )}

              {/* No Account Error - quando o email não existe */}
              {showNoAccountError && (
                <div className="no-account-error">
                  <span>{t('login.noAccount')}</span>
                  <Link href="/signup" className="create-account-link">
                    {t('login.clickHere')}
                  </Link>
                  <span>{t('login.toCreateOne')}</span>
                </div>
              )}

              {/* Forgot Password Link - aparece quando há erro de login */}
              {showLoginError && (
                <div className="forgot-password-link">
                  <span>{t('login.forgotPassword')}</span>
                  <button 
                    type="button" 
                    onClick={handleForgotPassword}
                    className="forgot-link-btn"
                  >
                    {t('login.clickHere2')}
                  </button>
                </div>
              )}

              {/* Turnstile Captcha */}
              <div className="turnstile-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '1rem 0', minHeight: '70px', position: 'relative' }}>
                {captchaLoading && (
                  <div className="turnstile-skeleton">
                    <div className="turnstile-skeleton-icon">
                      <i className="fa-solid fa-shield-halved fa-beat-fade"></i>
                    </div>
                    <span>{t('login.verifyingSecurity')}</span>
                  </div>
                )}
                <div style={{ opacity: captchaLoading ? 0 : 1, transition: 'opacity 0.3s' }}>
                  {turnstileSiteKey ? (
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={turnstileSiteKey}
                      onSuccess={(token) => {
                        setCaptchaToken(token);
                        setCaptchaLoading(false);
                      }}
                      onError={() => {
                        setCaptchaToken(null);
                        setCaptchaLoading(false);
                      }}
                      onExpire={() => {
                        setCaptchaToken(null);
                        turnstileRef.current?.reset();
                      }}
                      onWidgetLoad={() => setCaptchaLoading(false)}
                      options={{
                        theme: 'dark',
                        size: 'normal',
                        appearance: 'always',
                        retry: 'auto',
                      }}
                    />
                  ) : (
                    <p style={{ color: 'red', fontSize: '12px' }}>{t('login.turnstileNotConfigured')}</p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button 
                type="submit" 
                className="btn btn-primary btn-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>{t('login.verifying')}</span>
                  </>
                ) : (
                  t('login.continue')
                )}
              </button>
            </form>

            {/* Divider */}
            {!isAdminLogin && (
              <>
                <div className="auth-divider">
                  <span>{t('login.or')}</span>
                </div>

                {/* Google Login */}
                <button 
                  type="button"
                  className="btn btn-google btn-full"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>{t('login.continueWithGoogle')}</span>
                </button>
              </>
            )}

            {/* Footer */}
            <div className="auth-footer">
              <p>
                {t('login.noAccountQuestion')}{' '}
                <Link href="/signup">{t('login.createHere')}</Link>
              </p>
            </div>
          </motion.div>
        )}

        {/* Passo 2: Verificação com Código OTP ou Magic Link */}
        {step === 'verification' && (
          <motion.div
            key="verification"
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {/* Security badge */}
            <motion.div 
              className="verify-security-badge"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <i className="fa-solid fa-shield-check"></i>
              <span>{t('login.twoStepVerification')}</span>
            </motion.div>

            {/* Email info with animation */}
            <motion.div 
              className="verify-email-info"
              variants={emailSentVariants}
              initial="initial"
              animate="animate"
            >
              <motion.div 
                className="verify-email-icon"
                variants={pulseVariants}
                animate="animate"
              >
                <i className="fa-solid fa-envelope-open-text"></i>
              </motion.div>
              <p>{t('login.sentVerificationTo')}</p>
              <strong>{email}</strong>
            </motion.div>

            {/* Instructions */}
            <motion.div 
              className="verify-instructions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <div className="instruction-step">
                <span className="step-number">1</span>
                <span>{t('login.openEmail')}</span>
              </div>
              <div className="instruction-step">
                <span className="step-number">2</span>
                <span>{t('login.clickLinkOrCode')}</span>
              </div>
              <div className="instruction-step">
                <span className="step-number">3</span>
                <span>{t('login.autoUpdates')}</span>
              </div>
            </motion.div>

            {/* OTP Form (caso receba código em vez de link) */}
            <form onSubmit={handleVerifyOtp} className="auth-form">
              <div className="form-group">
                <label htmlFor="otp">{t('login.orEnter6Digit')}</label>
                <div className="input-wrapper otp-input-wrapper">
                  <i className="fa-solid fa-key"></i>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    className="otp-input"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="auth-error">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit - só aparece se tiver código */}
              {otpCode.length === 6 && (
                <button 
                  type="submit" 
                  className="btn btn-primary btn-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>A verificar...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      <span>Verificar Código</span>
                    </>
                  )}
                </button>
              )}
            </form>

            {/* Waiting indicator */}
            <motion.div 
              className="verify-waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <i className="fa-solid fa-spinner fa-spin"></i>
              <span>{t('login.waitingVerification')}</span>
            </motion.div>

            {/* Resend code */}
            <div className="verify-resend">
              {resendCooldown > 0 ? (
                <span className="resend-cooldown">
                  {t('login.resendEmailIn')} {resendCooldown}s
                </span>
              ) : (
                <button 
                  type="button"
                  className="resend-btn"
                  onClick={handleResendCode}
                  disabled={isLoading}
                >
                  <i className="fa-solid fa-rotate-right"></i>
                  {t('login.resendEmail')}
                </button>
              )}
            </div>

            {/* Back button */}
            <div className="auth-footer">
              <motion.button 
                type="button"
                className="auth-back-btn"
                onClick={handleBackToCredentials}
                whileHover={{ x: -5 }}
                whileTap={{ scale: 0.95 }}
              >
                <i className="fa-solid fa-arrow-left"></i>
                {t('login.backToLogin')}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ==========================================
            FORGOT PASSWORD - Passo 1: Email
            ========================================== */}
        {step === 'forgot-email' && (
          <motion.div
            key="forgot-email"
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {/* Info */}
            <motion.div 
              className="forgot-info"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="forgot-icon">
                <i className="fa-solid fa-key"></i>
              </div>
              <p>{t('login.recoveryIntro')}</p>
            </motion.div>

            <form onSubmit={handleSendRecoveryCode} className="auth-form">
              {/* Email */}
              <div className="form-group">
                <label htmlFor="forgotEmail">Email</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-envelope"></i>
                  <input
                    id="forgotEmail"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="auth-error">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{error}</span>
                </div>
              )}

              {/* Turnstile Captcha */}
              <div className="turnstile-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '1rem 0', minHeight: '70px', position: 'relative' }}>
                {captchaLoading && (
                  <div className="turnstile-skeleton">
                    <div className="turnstile-skeleton-icon">
                      <i className="fa-solid fa-shield-halved fa-beat-fade"></i>
                    </div>
                    <span>A verificar segurança...</span>
                  </div>
                )}
                <div style={{ opacity: captchaLoading ? 0 : 1, transition: 'opacity 0.3s' }}>
                  {turnstileSiteKey ? (
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={turnstileSiteKey}
                      onSuccess={(token) => {
                        setCaptchaToken(token);
                        setCaptchaLoading(false);
                      }}
                      onError={() => {
                        setCaptchaToken(null);
                        setCaptchaLoading(false);
                      }}
                      onExpire={() => {
                        setCaptchaToken(null);
                        turnstileRef.current?.reset();
                      }}
                      onWidgetLoad={() => setCaptchaLoading(false)}
                      options={{
                        theme: 'dark',
                        size: 'normal',
                        appearance: 'always',
                        retry: 'auto',
                      }}
                    />
                  ) : (
                    <p style={{ color: 'red', fontSize: '12px' }}>{t('login.turnstileNotConfigured')}</p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button 
                type="submit" 
                className="btn btn-primary btn-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>{t('login.sending')}</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i>
                    <span>{t('login.sendCode')}</span>
                  </>
                )}
              </button>
            </form>

            {/* Back button */}
            <div className="auth-footer">
              <motion.button 
                type="button"
                className="auth-back-btn"
                onClick={handleBackToCredentials}
                whileHover={{ x: -5 }}
                whileTap={{ scale: 0.95 }}
              >
                <i className="fa-solid fa-arrow-left"></i>
                {t('login.backToLogin')}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ==========================================
            FORGOT PASSWORD - Passo 2: Código
            ========================================== */}
        {step === 'forgot-code' && (
          <motion.div
            key="forgot-code"
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {/* Email info with animation */}
            <motion.div 
              className="verify-email-info"
              variants={emailSentVariants}
              initial="initial"
              animate="animate"
            >
              <motion.div 
                className="verify-email-icon"
                variants={pulseVariants}
                animate="animate"
              >
                <i className="fa-solid fa-envelope-open-text"></i>
              </motion.div>
              <p>{t('login.sentCodeTo')}</p>
              <strong>{forgotEmail}</strong>
            </motion.div>

            <form onSubmit={handleVerifyRecoveryCode} className="auth-form">
              {/* Code Input */}
              <div className="form-group">
                <label htmlFor="forgotCode">{t('login.sixDigitCode')}</label>
                <div className="input-wrapper otp-input-wrapper">
                  <i className="fa-solid fa-key"></i>
                  <input
                    id="forgotCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    className="otp-input"
                    autoFocus
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="auth-error">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button 
                type="submit" 
                className="btn btn-primary btn-full"
                disabled={isLoading || forgotCode.length !== 6}
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>{t('login.verifying')}</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check"></i>
                    <span>{t('login.verifyCode')}</span>
                  </>
                )}
              </button>
            </form>

            {/* Resend code */}
            <div className="verify-resend">
              {resendCooldown > 0 ? (
                <span className="resend-cooldown">
                  {t('login.resendCodeIn')} {resendCooldown}s
                </span>
              ) : (
                <button 
                  type="button"
                  className="resend-btn"
                  onClick={handleResendRecoveryCode}
                  disabled={isLoading}
                >
                  <i className="fa-solid fa-rotate-right"></i>
                  {t('login.resendCode')}
                </button>
              )}
            </div>

            {/* Back button */}
            <div className="auth-footer">
              <motion.button 
                type="button"
                className="auth-back-btn"
                onClick={handleBackFromForgot}
                whileHover={{ x: -5 }}
                whileTap={{ scale: 0.95 }}
              >
                <i className="fa-solid fa-arrow-left"></i>
                {t('login.back')}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ==========================================
            FORGOT PASSWORD - Passo 3: Nova Password
            ========================================== */}
        {step === 'forgot-newpass' && (
          <motion.div
            key="forgot-newpass"
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {/* Success badge */}
            <motion.div 
              className="verify-security-badge success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <i className="fa-solid fa-circle-check"></i>
              <span>{t('login.codeVerified')}</span>
            </motion.div>

            <form onSubmit={handleSetNewPassword} className="auth-form">
              {/* New Password */}
              <div className="form-group">
                <label htmlFor="newPassword">{t('login.newPassword')}</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-lock"></i>
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    <i className={`fa-solid ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                {newPassword.length > 0 && (
                  <div className="password-requirements fade-in">
                    <ul>
                      <li className={passwordStrength.hasMinLength ? 'valid' : 'invalid'}>
                        <i className={`fa-solid ${passwordStrength.hasMinLength ? 'fa-check' : 'fa-xmark'}`}></i>
                        {t('login.min8chars')}
                      </li>
                      <li className={passwordStrength.hasUppercase ? 'valid' : 'invalid'}>
                        <i className={`fa-solid ${passwordStrength.hasUppercase ? 'fa-check' : 'fa-xmark'}`}></i>
                        {t('login.oneUppercase')}
                      </li>
                      <li className={passwordStrength.hasLowercase ? 'valid' : 'invalid'}>
                        <i className={`fa-solid ${passwordStrength.hasLowercase ? 'fa-check' : 'fa-xmark'}`}></i>
                        {t('login.oneLowercase')}
                      </li>
                      <li className={passwordStrength.hasNumber ? 'valid' : 'invalid'}>
                        <i className={`fa-solid ${passwordStrength.hasNumber ? 'fa-check' : 'fa-xmark'}`}></i>
                        {t('login.oneNumber')}
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="form-group">
                <label htmlFor="confirmNewPassword">{t('login.confirmNewPassword')}</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-lock"></i>
                  <input
                    id="confirmNewPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                </div>
                {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
                  <span className="password-mismatch">
                    <i className="fa-solid fa-xmark"></i>
                    {t('login.passwordsNoMatch')}
                  </span>
                )}
                {confirmNewPassword.length > 0 && newPassword === confirmNewPassword && (
                  <span className="password-match">
                    <i className="fa-solid fa-check"></i>
                    {t('login.passwordsMatch')}
                  </span>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="auth-error">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button 
                type="submit" 
                className="btn btn-primary btn-full"
                disabled={isLoading || !isPasswordValid() || newPassword !== confirmNewPassword}
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>{t('login.updating')}</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-shield-check"></i>
                    <span>{t('login.updatePassword')}</span>
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
        </AnimatePresence>
        </motion.div>
      <Footer />
      </div>
    </>
  );
}
