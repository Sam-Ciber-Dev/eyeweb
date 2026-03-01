'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import '../../login/login.css';

interface PasswordStrength {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

export default function CompleteSignupPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Password strength
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
  });

  // Obter dados do utilizador do Google
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Não há utilizador, redirecionar para login
        router.push('/login');
        return;
      }

      // Verificar se já tem password (não é só OAuth)
      const hasEmailIdentity = user.identities?.some(
        (identity) => identity.provider === 'email'
      );
      const hasPasswordFlag = user.user_metadata?.has_password === true;

      if (hasEmailIdentity || hasPasswordFlag) {
        // Já tem password, redirecionar para perfil
        router.push('/perfil');
        return;
      }

      // Preencher dados do Google
      setEmail(user.email || '');
      setDisplayName(user.user_metadata?.full_name || user.user_metadata?.name || '');
      setIsLoading(false);
    };

    getUser();
  }, [router]);

  // Validar força da password
  useEffect(() => {
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
    });
  }, [password]);

  const isPasswordValid = () => {
    return Object.values(passwordStrength).every(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações
    if (!isPasswordValid()) {
      setError('Password does not meet the minimum requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSaving(true);

    try {
      // Atualizar o utilizador com a password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: {
          display_name: displayName,
          has_password: true,
        },
      });

      if (updateError) {
        throw updateError;
      }

      // Password definida com sucesso — redirecionar para home
      window.location.replace('/');
      
    } catch (err: unknown) {
      console.error('Complete signup error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error setting up account. Please try again.';
      setError(errorMessage);
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="auth-container">
        <div className="auth-loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <Link href="/" className="auth-logo">
            <i className="fa-solid fa-eye"></i>
            <span>Eye Web</span>
          </Link>
          <h1>Complete sign up</h1>
          <p>Set a password for your account</p>
        </div>

        {/* Info do Google */}
        <div className="auth-google-info">
          <i className="fa-brands fa-google"></i>
          <span>Google account: {email}</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Display Name */}
          <div className="form-group">
            <label htmlFor="displayName">Display name</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-user"></i>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
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
            <div className="password-requirements">
              <ul>
                <li className={passwordStrength.hasMinLength ? 'valid' : 'invalid'}>
                  <i className={`fa-solid ${passwordStrength.hasMinLength ? 'fa-check' : 'fa-xmark'}`}></i>
                  Minimum 8 characters
                </li>
                <li className={passwordStrength.hasUppercase ? 'valid' : 'invalid'}>
                  <i className={`fa-solid ${passwordStrength.hasUppercase ? 'fa-check' : 'fa-xmark'}`}></i>
                  One uppercase letter
                </li>
                <li className={passwordStrength.hasLowercase ? 'valid' : 'invalid'}>
                  <i className={`fa-solid ${passwordStrength.hasLowercase ? 'fa-check' : 'fa-xmark'}`}></i>
                  One lowercase letter
                </li>
                <li className={passwordStrength.hasNumber ? 'valid' : 'invalid'}>
                  <i className={`fa-solid ${passwordStrength.hasNumber ? 'fa-check' : 'fa-xmark'}`}></i>
                  One number
                </li>
              </ul>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
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
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-check"></i>
                <span>Complete sign up</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
