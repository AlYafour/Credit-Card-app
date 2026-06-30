'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CreditCard,
  Receipt,
  Upload,
  Banknote,
  Settings,
  Menu,
  X,
  Wallet,
  FileText,
  BarChart3,
  History,
  Store,
  ShoppingBasket,
  Users,
  BotMessageSquare,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from '@/lib/i18n';

interface SidebarProps {
  userEmail?: string;
  onLogout: () => void;
}

export default function Sidebar({ userEmail, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { t, locale, isRTL } = useTranslations();

  const menuItems = [
    { href: '/dashboard', label: t('navigation.dashboard'), icon: LayoutDashboard, key: 'dashboard' },
    { href: '/chat', label: locale === 'ar' ? 'المساعد الذكي' : 'AI Assistant', icon: BotMessageSquare, key: 'chat' },
    { href: '/cards', label: t('navigation.cards'), icon: CreditCard, key: 'cards' },
    { href: '/transactions', label: t('navigation.transactions'), icon: Receipt, key: 'transactions' },
    { href: '/merchants', label: t('navigation.merchants' as any) || 'Merchants', icon: Store, key: 'merchants' },
    { href: '/baskets', label: t('navigation.baskets' as any) || 'Baskets', icon: ShoppingBasket, key: 'baskets' },
    { href: '/cardholders', label: t('navigation.cardholders' as any) || 'Cardholders', icon: Users, key: 'cardholders' },
    { href: '/sms-parser', label: t('navigation.addTransaction'), icon: Upload, key: 'addTransaction' },
    { href: '/statement', label: t('navigation.statement') || 'كشف الحساب', icon: FileText, key: 'statement' },
    { href: '/reports', label: t('navigation.reports'), icon: BarChart3, key: 'reports' },
    { href: '/statements', label: t('navigation.statementHistory'), icon: History, key: 'statements' },
    { href: '/cash', label: t('navigation.cash') || 'Cash', icon: Banknote, key: 'cash' },
    { href: '/settings', label: t('common.settings') || 'Settings', icon: Settings, key: 'settings' },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  if (pathname?.startsWith('/login') || pathname?.startsWith('/register')) {
    return null;
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="mobile-menu-btn"
        aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
        style={{ display: 'none' }}
      >
        {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`sidebar ${isMobileOpen ? 'open' : ''}`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex flex-col" style={{ height: '100%' }}>
          {/* Logo Section */}
          <div className="sidebar-header">
            <a href="/dashboard" className="sidebar-brand">
              <Wallet size={22} />
              <span suppressHydrationWarning>{t('common.appName')}</span>
            </a>
          </div>

          {/* Navigation */}
          <nav className="sidebar-nav">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`nav-item ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="sidebar-user-section">
            <div className="sidebar-user-box">
              <p className="sidebar-user-label">{t('common.user')}</p>
              <p className="sidebar-user-email">{userEmail || 'User'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="sidebar-overlay visible"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
