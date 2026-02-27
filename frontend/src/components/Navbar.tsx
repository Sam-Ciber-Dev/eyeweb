'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Avatar from '@/components/Avatar';

interface NavbarProps {
  showLogin?: boolean;
}

export default function Navbar({ showLogin = true }: NavbarProps) {
  const router = useRouter();
  const { user, profile, isAuthenticated, isAdmin, logout, loading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      setDropdownOpen(false);
      await logout();
      // O logout já redireciona, não precisa fazer mais nada
    } catch (err) {
      console.error('Logout error:', err);
      // Forçar reload em caso de erro
      window.location.href = '/';
    }
  };

  const getDisplayName = () => {
    if (profile?.display_name) return profile.display_name;
    if (user?.email) return user.email.split('@')[0];
    return 'Utilizador';
  };

  // Get avatar URL from profile or user metadata
  const getAvatarUrl = () => {
    if (profile?.avatar_url) return profile.avatar_url;
    if (user?.user_metadata?.avatar_url) return user.user_metadata.avatar_url;
    if (user?.user_metadata?.picture) return user.user_metadata.picture;
    return null;
  };

  const avatarUrl = getAvatarUrl();

  return (
    <nav className="navbar">
      <Link href="/" className="logo-text">
        Eye Web
      </Link>
      <div className="navbar-right">
        <Link href="/about" className="nav-link">
          About
        </Link>
        
        {showLogin && !loading && (
          <>
            {isAuthenticated ? (
              <div className="user-menu" ref={dropdownRef}>
                <button 
                  className="user-avatar-btn"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-expanded={dropdownOpen}
                >
                  <Avatar 
                    src={avatarUrl}
                    name={profile?.display_name ?? undefined}
                    email={user?.email}
                    size="sm"
                  />
                  <i className={`fa-solid fa-chevron-${dropdownOpen ? 'up' : 'down'}`}></i>
                </button>

                {dropdownOpen && (
                  <div className="user-dropdown">
                    <div className="dropdown-header">
                      <span className="dropdown-name">{getDisplayName()}</span>
                      <span className="dropdown-email">{user?.email}</span>

                    </div>
                    
                    <div className="dropdown-divider"></div>
                    
                    <Link 
                      href="/perfil" 
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="fa-solid fa-user"></i>
                      O meu perfil
                    </Link>
                    
                    {isAdmin && (
                      <Link 
                        href="/admin" 
                        className="dropdown-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <i className="fa-solid fa-gauge-high"></i>
                        Painel Admin
                      </Link>
                    )}
                    
                    <div className="dropdown-divider"></div>
                    
                    <button 
                      className="dropdown-item dropdown-item-danger"
                      onClick={handleLogout}
                    >
                      <i className="fa-solid fa-right-from-bracket"></i>
                      Terminar sessão
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="nav-icon" title="Login">
                <i className="fa-solid fa-user"></i>
              </Link>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
