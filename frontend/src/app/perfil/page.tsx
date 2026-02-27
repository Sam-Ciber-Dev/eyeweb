'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Avatar from '@/components/Avatar';

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

// Loading Overlay component
function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <p>{message}</p>
      </div>
    </div>
  );
}

// Toast notification component
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  
  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 1700);
    
    const closeTimer = setTimeout(() => {
      onClose();
    }, 2000);
    
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [onClose]);

  return (
    <div className={`toast ${isExiting ? 'toast-exit' : ''}`}>
      <span>{message}</span>
    </div>
  );
}

// Edit Name Modal
function EditNameModal({ 
  isOpen, 
  onClose, 
  currentName, 
  onSave,
  t 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  currentName: string;
  onSave: (name: string) => void;
  t: (key: string) => string;
}) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    setName(currentName);
    setError(null);
  }, [currentName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar nome
    const validation = validateDisplayName(name, t);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }
    
    setError(null);
    onSave(name.trim());
  };

  const handleNameChange = (value: string) => {
    setName(value);
    // Limpar erro quando começa a escrever
    if (error) setError(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('profile.editName')}</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t('profile.namePlaceholder')}
              autoFocus
              maxLength={30}
            />
            {error && (
              <div className="modal-error">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}
            <div className="name-hint">
              <small>{t('profile.nameHint')}</small>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              {t('profile.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('profile.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PerfilPage() {
  const router = useRouter();
  const { user, profile, isAuthenticated, isAdmin, logout, loading, refreshProfile } = useAuth();
  const { t } = useLanguage();
  
  const [authChecked, setAuthChecked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Loading state
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Toast notification
  const [toast, setToast] = useState<string | null>(null);
  
  // Avatar hover state
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);
  
  // Edit name modal
  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  
  const showProcessing = (message: string) => {
    setLoadingMessage(message);
    setIsProcessing(true);
  };
  
  const hideProcessing = () => {
    setIsProcessing(false);
    setLoadingMessage('');
  };
  
  const showToast = (message: string) => {
    setToast(message);
  };

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setAuthChecked(true);
        if (!isAuthenticated) {
          router.push('/login');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loading, router]);

  // Handle name save
  const handleSaveName = async (newName: string) => {
    if (!user) return;
    
    setIsEditNameOpen(false);
    showProcessing(t('profile.updatingName'));

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: newName })
        .eq('id', user.id);

      if (updateError) {
        console.error('Supabase error:', updateError);
        hideProcessing();
        return;
      }

      await refreshProfile();
      
      // Wait for loading animation
      setTimeout(() => {
        hideProcessing();
        showToast(t('profile.nameUpdated'));
      }, 1500);
      
    } catch (err: any) {
      console.error('Error updating profile:', err);
      hideProcessing();
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Handle avatar upload
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    showProcessing(t('profile.updatingPhoto'));

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        hideProcessing();
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        hideProcessing();
        return;
      }

      await refreshProfile();
      
      setTimeout(() => {
        hideProcessing();
        showToast(t('profile.photoUpdated'));
      }, 1500);
      
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      hideProcessing();
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    showProcessing(t('profile.removingPhoto'));

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        hideProcessing();
        return;
      }

      await refreshProfile();
      
      setTimeout(() => {
        hideProcessing();
        showToast(t('profile.photoRemoved'));
      }, 1500);
      
    } catch (err: any) {
      console.error('Remove avatar error:', err);
      hideProcessing();
    }
  };

  if (loading || !authChecked) {
    return (
      <div className="auth-container">
        <div className="auth-loading">
          <div className="spinner"></div>
          <p>{t('profile.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Navbar />
      
      {/* Loading Overlay */}
      {isProcessing && <LoadingOverlay message={loadingMessage} />}
      
      {/* Toast Container */}
      {toast && (
        <div className="toast-container">
          <Toast message={toast} onClose={() => setToast(null)} />
        </div>
      )}
      
      {/* Edit Name Modal */}
      <EditNameModal
        isOpen={isEditNameOpen}
        onClose={() => setIsEditNameOpen(false)}
        currentName={profile?.display_name || ''}
        onSave={handleSaveName}
        t={t}
      />
      
      <div className="profile-container">
        <div className="profile-content">
          {/* Header */}
          <div className="profile-header">
            <div className="profile-avatar-section">
              <div 
                className="avatar-wrapper"
                onMouseEnter={() => setIsAvatarHovered(true)}
                onMouseLeave={() => setIsAvatarHovered(false)}
              >
                <Avatar 
                  src={profile?.avatar_url}
                  name={profile?.display_name ?? undefined}
                  email={user?.email}
                  size="xl"
                />
                
                {/* Overlay buttons on hover */}
                {isAvatarHovered && (
                  <div className="avatar-hover-actions">
                    <button 
                      className="avatar-btn avatar-btn-edit"
                      onClick={handleAvatarClick}
                      disabled={isProcessing}
                      title={t('profile.changePhoto')}
                    >
                      <i className="fa-solid fa-pencil"></i>
                    </button>
                    {profile?.avatar_url && (
                      <button 
                        className="avatar-btn avatar-btn-delete"
                        onClick={handleRemoveAvatar}
                        disabled={isProcessing}
                        title={t('profile.removePhoto')}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
            <div className="profile-info">
              <div className="profile-name-wrapper">
                <h1>{profile?.display_name || user?.email?.split('@')[0]}</h1>
                <button 
                  className="name-edit-btn"
                  onClick={() => setIsEditNameOpen(true)}
                  title={t('profile.editName')}
                >
                  <i className="fa-solid fa-pencil"></i>
                </button>
              </div>
              <p>{user?.email}</p>

            </div>
          </div>

          {/* Admin Link */}
          {isAdmin && (
            <div className="admin-panel-link">
              <Link href="/admin" className="btn btn-admin">
                <i className="fa-solid fa-gauge-high"></i>
                <span>{t('profile.goToAdmin')}</span>
                <i className="fa-solid fa-arrow-right"></i>
              </Link>
            </div>
          )}

          {/* Logout */}
          <div className="profile-actions">
            <button 
              className="btn btn-danger"
              onClick={handleLogout}
            >
              <i className="fa-solid fa-right-from-bracket"></i>
              {t('profile.logout')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
