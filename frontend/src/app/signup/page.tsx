'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase, isAdminEmail } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { motion, AnimatePresence } from 'framer-motion';

// ===========================================
// VALIDAÇÃO DE NOME DE UTILIZADOR
// ===========================================

interface NameValidation {
  isValid: boolean;
  error: string | null;
}

function validateDisplayName(name: string, t: (key: string) => string): NameValidation {
  const trimmedName = name.trim();
  
  if (!trimmedName) {
    return { isValid: false, error: t('signup.nameEmpty') };
  }
  
  if (trimmedName.length < 2) {
    return { isValid: false, error: t('signup.nameMinChars') };
  }
  
  if (trimmedName.length > 30) {
    return { isValid: false, error: t('signup.nameMaxChars') };
  }
  
  if (!/^[a-zA-ZÀ-ÿ]/.test(trimmedName)) {
    return { isValid: false, error: t('signup.nameStartLetter') };
  }
  
  if (!/^[a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s\-']*[a-zA-ZÀ-ÿ]$|^[a-zA-ZÀ-ÿ]$/.test(trimmedName)) {
    return { isValid: false, error: t('signup.nameOnlyLetters') };
  }
  
  if (/\s{2,}/.test(trimmedName)) {
    return { isValid: false, error: t('signup.nameNoConsecutiveSpaces') };
  }
  
  if (/\-{2,}/.test(trimmedName)) {
    return { isValid: false, error: t('signup.nameNoConsecutiveHyphens') };
  }
  
  if (/^(.)\1+$/.test(trimmedName.replace(/\s/g, ''))) {
    return { isValid: false, error: t('signup.nameNoRepeated') };
  }
  
  // Lista de palavras/padrões não permitidos
  const blockedPatterns = [
    /admin/i, /root/i, /system/i, /moderator/i, /staff/i,
    /support/i, /oficial/i, /official/i, /eyeweb/i,
    /fuck/i, /shit/i, /ass/i, /dick/i, /pussy/i, /bitch/i,
    /caralho/i, /foda/i, /puta/i, /merda/i, /cona/i, /pila/i,
    /nigger/i, /nigga/i, /faggot/i
  ];
  
  for (const pattern of blockedPatterns) {
    if (pattern.test(trimmedName)) {
      return { isValid: false, error: t('signup.nameNotAllowed') };
    }
  }
  
  return { isValid: true, error: null };
}

interface PasswordStrength {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

// Wrapper com Suspense para useSearchParams
export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="auth-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', background: '#0a0a0a' }}>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signupWithGoogle, isAuthenticated, loading } = useAuth();
  const { t } = useLanguage();
  const fromGoogle = searchParams.get('from') === 'google';
  
  // Form state
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminSignup, setIsAdminSignup] = useState(false);
  const [showEmailExistsError, setShowEmailExistsError] = useState(false);
  
  // Verification code state
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Turnstile captcha
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

  // Password strength
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
  });

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0, x: 100 },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    },
    exit: {
      opacity: 0,
      x: -100,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    },
  };

  const backVariants = {
    initial: { opacity: 0, x: -100 },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
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
      scale: [1, 1.1, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut' as const,
      },
    },
  };

  // Redirecionar se já autenticado
  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  // Verificar avisos/erros na URL
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const noticeParam = searchParams.get('notice');
    // Pré-preencher com dados vindos do Google (passados como URL params)
    const nameParam = searchParams.get('name');
    const emailParam = searchParams.get('email');
    if (nameParam && !displayName) setDisplayName(nameParam);
    if (emailParam && !email) setEmail(emailParam);

    if (errorParam === 'no_account' || errorParam === 'no_signup') {
      setError(t('signup.googleNotRegistered'));
    } else if (noticeParam === 'google_signup') {
      setError(t('signup.fillData'));
    } else if (errorParam === 'account_exists') {
      setError(t('signup.emailAlreadyExists'));
    }
  }, [searchParams]);

  // Detectar se é email de admin (async)
  useEffect(() => {
    const checkAdmin = async () => {
      if (email && email.includes('@')) {
        const isAdmin = await isAdminEmail(email);
        setIsAdminSignup(isAdmin);
      } else {
        setIsAdminSignup(false);
      }
    };
    
    const timeoutId = setTimeout(checkAdmin, 300);
    return () => clearTimeout(timeoutId);
  }, [email]);

  // Validar força da password
  useEffect(() => {
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
    });
  }, [password]);

  // Cooldown timer para reenvio
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const isPasswordValid = () => {
    return Object.values(passwordStrength).every(Boolean);
  };

  // Handler para mudança de nome com validação em tempo real
  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (displayNameError) setDisplayNameError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowEmailExistsError(false);
    setDisplayNameError(null);

    // Validar nome
    const nameValidation = validateDisplayName(displayName, t);
    if (!nameValidation.isValid) {
      setDisplayNameError(nameValidation.error);
      return;
    }

    // Validações
    if (!isPasswordValid()) {
      setError(t('signup.passwordRequirements'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('signup.passwordMismatch'));
      return;
    }

    if (isAdminSignup) {
      setError(t('signup.emailBlocked'));
      return;
    }

    // ─── GOOGLE SIGNUP: email já verificado → criar conta direto ───
    if (fromGoogle) {
      // Captcha ainda é necessário para proteção contra bots
      if (!captchaToken) {
        setError(t('signup.completeSecurity'));
        return;
      }

      setIsLoading(true);
      turnstileRef.current?.reset();
      setCaptchaToken(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const resp = await fetch(`${apiUrl}/api/v1/auth/register-google-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            display_name: displayName || email.split('@')[0],
          }),
        });

        const result = await resp.json();

        if (!resp.ok) {
          if (resp.status === 409) {
            // Email já existe
            setShowEmailExistsError(true);
            setIsLoading(false);
            return;
          }
          throw new Error(result.detail || t('signup.createError'));
        }

        // Conta criada com email confirmado → fazer login automático
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) throw loginError;

        // Saltar a animação do olho e ir para home
        sessionStorage.setItem('eyeweb_intro_seen', 'true');
        window.location.href = '/';
        return;
      } catch (err: any) {
        console.error('Google signup error:', err);
        if (err.message?.includes('already') || err.message?.includes('registada')) {
          setShowEmailExistsError(true);
        } else {
          setError(err.message || t('signup.createErrorRetry'));
        }
        setIsLoading(false);
        return;
      }
    }

    // ─── SIGNUP NORMAL: verificação por email ───
    if (!captchaToken) {
      setError(t('signup.completeSecurity'));
      return;
    }

    setIsLoading(true);
    
    // Reset captcha (já validámos visualmente)
    turnstileRef.current?.reset();
    setCaptchaToken(null);

    try {
      // Verificar se o email já existe usando RPC function (bypass RLS)
      const { data: emailExists } = await supabase.rpc('check_email_exists', {
        p_email: email
      });
      
      if (emailExists) {
        // Email já existe
        setShowEmailExistsError(true);
        setIsLoading(false);
        return;
      }

      // Registar com Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split('@')[0],
          },
        },
      });

      if (signUpError) throw signUpError;

      // Se o email confirmation está ativo, mostra o step de verificação
      if (data.user && !data.session) {
        // Supabase enviou email de confirmação
        setStep('verify');
        setResendCooldown(60);
      } else if (data.session) {
        // Signup automático (email confirmation desativado)
        sessionStorage.setItem('eyeweb_intro_seen', 'true');
        window.location.href = '/';
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.message.includes('already registered') || err.message.includes('already been registered')) {
        setShowEmailExistsError(true);
      } else {
        setError(err.message || t('signup.createErrorRetry'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Só aceitar números
    const numericValue = value.replace(/\D/g, '').slice(-1);
    
    const newCode = [...verificationCode];
    newCode[index] = numericValue;
    setVerificationCode(newCode);

    // Auto-focus no próximo input
    if (numericValue && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Se todos os dígitos preenchidos, verificar automaticamente
    if (newCode.every(d => d) && newCode.join('').length === 6) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setVerificationCode(pasted.split(''));
      codeInputRefs.current[5]?.focus();
      handleVerifyCode(pasted);
    }
  };

  const handleVerifyCode = async (code: string) => {
    setError(null);
    setIsLoading(true);

    try {
      // Supabase usa OTP verification - tipo 'signup' para confirmação de registo
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });

      if (verifyError) throw verifyError;

      // Aguardar um pouco para a sessão ser estabelecida
      await new Promise(resolve => setTimeout(resolve, 500));

      // Saltar a animação do olho (EyeIntro) ao redirecionar
      sessionStorage.setItem('eyeweb_intro_seen', 'true');

      // Sucesso - redireciona para a página principal
      window.location.href = '/';
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(t('signup.invalidCode'));
      setVerificationCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    setError(null);
    setIsLoading(true);

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          captchaToken: captchaToken || undefined,
        },
      });

      // Reset captcha
      turnstileRef.current?.reset();
      setCaptchaToken(null);

      if (resendError) throw resendError;
      
      setResendCooldown(60);
    } catch (err: any) {
      console.error('Resend error:', err);
      setError(t('signup.resendError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (isAdminSignup) {
      setError(t('signup.adminManualOnly'));
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await signupWithGoogle();
    } catch (err: any) {
      console.error('Google signup error:', err);
      setError(err.message || t('signup.googleError'));
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-loading">
          <div className="spinner"></div>
          <p>{t('signup.loading')}</p>
        </div>
      </div>
    );
  }

  // Step: Verificação de código
  if (step === 'verify') {
    return (
      <div className="auth-container">
        <motion.div 
          className="auth-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Back Arrow */}
          <button 
            onClick={() => setStep('form')} 
            className="auth-back-arrow"
            style={{ border: 'none', cursor: 'pointer' }}
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          
          <motion.div 
            className="auth-email-sent"
            variants={emailSentVariants}
            initial="initial"
            animate="animate"
          >
            <motion.div 
              className="icon"
              variants={pulseVariants}
              animate="animate"
            >
              <i className="fa-solid fa-envelope-circle-check"></i>
            </motion.div>
            <h2>{t('signup.verifyEmail')}</h2>
            <p>
              {t('signup.sentCodeTo')}{' '}
              <span className="email-highlight">{email}</span>
            </p>
          </motion.div>

          {/* Code Input */}
          <motion.div 
            className="verification-code-input"
            onPaste={handleCodePaste}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {verificationCode.map((digit, index) => (
              <input
                key={index}
                ref={el => { codeInputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(index, e)}
                className={digit ? 'filled' : ''}
                disabled={isLoading}
              />
            ))}
          </motion.div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div 
                className="auth-error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Resend */}
          <div className="resend-code">
            <button 
              onClick={handleResendCode}
              disabled={resendCooldown > 0 || isLoading}
            >
              {resendCooldown > 0 
                ? `${t('signup.resendCodeIn')} ${resendCooldown}s`
                : t('signup.resendCode')
              }
            </button>
          </div>

          {/* Turnstile Captcha (para resend) */}
          <div className="turnstile-container" style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
            <Turnstile
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''}
              onSuccess={(token) => setCaptchaToken(token)}
              onError={() => setCaptchaToken(null)}
              onExpire={() => {
                setCaptchaToken(null);
                turnstileRef.current?.reset();
              }}
              options={{
                theme: 'dark',
                size: 'compact',
              }}
            />
          </div>

          <motion.div 
            className="auth-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p>
              <motion.button 
                onClick={() => { setStep('form'); setError(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}
                whileHover={{ x: -5 }}
                whileTap={{ scale: 0.95 }}
              >
                {t('signup.backToForm')}
              </motion.button>
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Step: Formulário de registo
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
          <Link href="/login" className="auth-back-arrow">
            <i className="fa-solid fa-arrow-left"></i>
          </Link>
          
          {/* Header */}
          <div className="auth-header">
            <Link href="/" className="auth-logo">
              <i className="fa-solid fa-eye"></i>
              <span>Eye Web</span>
            </Link>
          <h1>Sign up</h1>
        </div>

        {/* Aviso Admin */}
        {isAdminSignup && (
          <div className="auth-admin-warning">
            <i className="fa-solid fa-ban"></i>
            <span>{t('signup.emailCannotRegister')}</span>
          </div>
        )}

        {/* Error/Warning Message (topo do formulário) */}
        <AnimatePresence>
          {error && (
            <motion.div 
              className="auth-error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Display Name */}
          <div className="form-group">
            <label htmlFor="displayName">{t('signup.name')}</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-user"></i>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                placeholder={t('signup.namePlaceholder')}
                autoComplete="off"
                maxLength={30}
                required
              />
            </div>
            {displayNameError && (
              <div className="field-error">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{displayNameError}</span>
              </div>
            )}
            <small className="field-hint">{t('signup.nameHint')}</small>
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-envelope"></i>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setShowEmailExistsError(false);
                }}
                placeholder="email@exemplo.com"
                required
                autoComplete="off"
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
                autoComplete="new-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {password.length > 0 && (
              <div className="password-requirements fade-in">
                <ul>
                  <li className={passwordStrength.hasMinLength ? 'valid' : 'invalid'}>
                    <i className={`fa-solid ${passwordStrength.hasMinLength ? 'fa-check' : 'fa-xmark'}`}></i>
                    {t('signup.min8chars')}
                  </li>
                  <li className={passwordStrength.hasUppercase ? 'valid' : 'invalid'}>
                    <i className={`fa-solid ${passwordStrength.hasUppercase ? 'fa-check' : 'fa-xmark'}`}></i>
                    {t('signup.oneUppercase')}
                  </li>
                  <li className={passwordStrength.hasLowercase ? 'valid' : 'invalid'}>
                    <i className={`fa-solid ${passwordStrength.hasLowercase ? 'fa-check' : 'fa-xmark'}`}></i>
                    {t('signup.oneLowercase')}
                  </li>
                  <li className={passwordStrength.hasNumber ? 'valid' : 'invalid'}>
                    <i className={`fa-solid ${passwordStrength.hasNumber ? 'fa-check' : 'fa-xmark'}`}></i>
                    {t('signup.oneNumber')}
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="confirmPassword">{t('signup.confirmPassword')}</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-lock"></i>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Email Already Exists Error */}
          {showEmailExistsError && (
            <div className="email-exists-error">
              <span>{t('signup.emailAlreadyAccount')}</span>
              <Link href="/login" className="login-link">
                {t('signup.clickHere')}
              </Link>
              <span>{t('signup.toLogin')}</span>
            </div>
          )}

          {/* Turnstile Captcha */}
          <div className="turnstile-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '1rem 0', minHeight: '70px', position: 'relative' }}>
              {captchaLoading && (
                <div className="turnstile-skeleton">
                  <div className="turnstile-skeleton-icon">
                    <i className="fa-solid fa-shield-halved fa-beat-fade"></i>
                  </div>
                  <span>{t('signup.verifyingSecurity')}</span>
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
                  <p style={{ color: 'red', fontSize: '12px' }}>{t('signup.turnstileNotConfigured')}</p>
                )}
              </div>
            </div>

          {/* Submit */}
          <button 
            type="submit" 
            className="btn btn-primary btn-full"
            disabled={isLoading || isAdminSignup}
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>{t('signup.creating')}</span>
              </>
            ) : (
              t('signup.createAccount')
            )}
          </button>
        </form>

        {/* Divider */}
        {!isAdminSignup && !fromGoogle && (
          <>
            <div className="auth-divider">
              <span>{t('signup.or')}</span>
            </div>

            {/* Google Signup */}
            <button 
              type="button"
              className="btn btn-google btn-full"
              onClick={handleGoogleSignup}
              disabled={isLoading}
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{t('signup.continueWithGoogle')}</span>
            </button>
          </>
        )}

        {/* Footer */}
        <div className="auth-footer">
          <p>
            {t('signup.alreadyHaveAccount')}{' '}
            <Link href="/login">{t('signup.loginHere')}</Link>
          </p>
        </div>
        </motion.div>
      </div>
      <Footer />
    </>
  );
}
