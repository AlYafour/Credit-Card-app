'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { useTranslations } from '@/lib/i18n';
import { User, LogOut, Moon, Sun } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { getResolvedTheme, setTheme } from '@/lib/theme';
import LanguageSwitcher from './LanguageSwitcher';
import StatementBgBadge from './StatementBgBadge';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { t } = useTranslations();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentTheme(getResolvedTheme());
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowUserMenu(false);
    };
    if (showUserMenu) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showUserMenu]);

  const handleLogout = () => {
    logout();
    router.push('/login');
    setShowUserMenu(false);
  };

  const toggleTheme = () => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    setCurrentTheme(newTheme);
  };

  if (pathname?.startsWith('/login') || pathname?.startsWith('/register')) {
    return null;
  }

  return (
    <nav className="navbar" role="banner" aria-label="Top navigation">
      <div className="navbar-content">
        <div className="navbar-actions">
          <StatementBgBadge />

          <button
            onClick={toggleTheme}
            className="btn btn-secondary btn-icon-only"
            aria-label={currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {currentTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <LanguageSwitcher />

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="btn btn-secondary"
              aria-expanded={showUserMenu}
              aria-haspopup="true"
              style={{
                padding: 'var(--space-2) var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <User size={16} />
              <span style={{ fontSize: '0.875rem' }}>{user?.email?.split('@')[0] || 'User'}</span>
            </button>

            {showUserMenu && (
              <div className="user-menu" role="menu">
                <div className="user-menu-header">
                  <p className="user-menu-email">{user?.email || 'User'}</p>
                  <p className="user-menu-label">{t('common.profile')}</p>
                </div>
                <button
                  onClick={() => {
                    router.push('/settings');
                    setShowUserMenu(false);
                  }}
                  className="user-menu-item"
                  role="menuitem"
                >
                  <span>{t('common.settings') || 'Settings'}</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="user-menu-item user-menu-item-danger"
                  role="menuitem"
                >
                  <LogOut size={16} />
                  <span>{t('navigation.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

