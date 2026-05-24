'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { useAuthStore } from '@/app/store/authStore';
import { authAPI } from '@/app/api/auth';
import api from '@/app/api/client';
import { getErrorMessage } from '@/lib/errors';
import { getTheme, setTheme, type Theme } from '@/lib/theme';
import toast from 'react-hot-toast';
import {
  User,
  Lock,
  Palette,
  Globe,
  Sun,
  Moon,
  Monitor,
  Mail,
  Eye,
  EyeOff,
  Shield,
  Check,
  Save,
  Fingerprint,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import PasswordStrength from '@/components/ui/PasswordStrength';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loadUser } = useAuthStore();
  const { t, locale, setLocale } = useTranslations();

  const [fullName, setFullName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [currentTheme, setCurrentTheme] = useState<Theme>('system');

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricCredentials, setBiometricCredentials] = useState<Array<{ id: string; device_name: string; created_at: string | null; last_used_at: string | null }>>([]);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricFetching, setBiometricFetching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => {
        toast.error(t('errors.unauthorized'));
        router.push('/login');
      });
    }
  }, [isAuthenticated, loadUser, router, t]);

  useEffect(() => {
    if (user) setFullName(user.full_name || '');
  }, [user]);

  useEffect(() => {
    setCurrentTheme(getTheme());
  }, []);

  const loadBiometricCredentials = async () => {
    if (!isAuthenticated) return;
    setBiometricFetching(true);
    try {
      const creds = await authAPI.getBiometricCredentials();
      setBiometricCredentials(creds);
    } catch {
      // silently fail — endpoint might not exist yet
    } finally {
      setBiometricFetching(false);
    }
  };

  useEffect(() => {
    authAPI.checkBiometricSupport().then(setBiometricAvailable);
    loadBiometricCredentials();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleBiometricRegister = async () => {
    setBiometricLoading(true);
    try {
      const result = await authAPI.registerBiometric();
      if (result.success) {
        toast.success(t('settings.biometricEnabled') || 'Biometric login enabled!');
        await loadBiometricCredentials();
      } else {
        toast.error(result.error || t('settings.biometricFailed') || 'Registration failed');
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to register biometric'));
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleBiometricDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await authAPI.deleteBiometricCredential(id);
      toast.success(t('settings.biometricRemoved') || 'Biometric credential removed');
      setBiometricCredentials(prev => prev.filter(c => c.id !== id));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to remove credential'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await authAPI.updateProfile({ full_name: fullName });
      await loadUser();
      toast.success(t('settings.profileUpdated') || 'Profile updated successfully');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('settings.profileUpdateFailed') || 'Failed to update profile'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    try {
      await authAPI.changePassword({ current_password: currentPassword, new_password: newPassword });
      toast.success(t('settings.passwordChanged') || 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('settings.passwordChangeFailed') || 'Failed to change password'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleThemeChange = (theme: Theme) => {
    setCurrentTheme(theme);
    setTheme(theme);
  };

  const handleLanguageChange = (newLocale: 'en' | 'ar') => {
    if (newLocale !== locale) {
      setLocale(newLocale);
      authAPI.updateProfile({ preferred_language: newLocale }).catch(() => {});
      setTimeout(() => router.refresh(), 100);
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="text-secondary">{t('common.loading')}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon">
              <User size={32} />
            </div>
            <div className="page-header-text">
              <h1>{t('settings.title') || 'Settings'}</h1>
              <p className="page-subtitle">{t('settings.subtitle') || 'Manage your account preferences'}</p>
            </div>
          </div>
        </div>

        <div className="settings-layout">
          {/* Left Column */}
          <div className="settings-column">
            {/* Profile */}
            <div className="card settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon profile">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="settings-card-title">{t('settings.profileInfo') || 'Profile Information'}</h2>
                  <p className="settings-card-desc">{t('settings.profileDesc') || 'Update your personal details'}</p>
                </div>
              </div>

              <form onSubmit={handleProfileSave} className="settings-form">
                <div className="form-group">
                  <label htmlFor="email" className="settings-label">
                    <Mail size={14} />
                    {t('settings.email') || 'Email'}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    disabled
                    className="form-input settings-input-disabled"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fullName" className="settings-label">
                    <User size={14} />
                    {t('settings.fullName') || 'Full Name'}
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('settings.fullNamePlaceholder') || 'Enter your full name'}
                    className="form-input"
                  />
                </div>

                <button type="submit" disabled={profileLoading} className="btn btn-primary settings-save-btn">
                  <Save size={16} />
                  {profileLoading ? (t('common.saving') || 'Saving...') : (t('settings.saveProfile') || 'Save')}
                </button>
              </form>
            </div>

            {/* Password */}
            <div className="card settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon security">
                  <Shield size={20} />
                </div>
                <div>
                  <h2 className="settings-card-title">{t('settings.passwordSection') || 'Change Password'}</h2>
                  <p className="settings-card-desc">{t('settings.passwordDesc') || 'Keep your account secure'}</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="settings-form">
                <div className="form-group">
                  <label htmlFor="currentPassword" className="settings-label">
                    <Lock size={14} />
                    {t('settings.currentPassword') || 'Current Password'}
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t('settings.currentPasswordPlaceholder') || 'Enter current password'}
                      className="form-input"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      tabIndex={-1}
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword" className="settings-label">
                    <Lock size={14} />
                    {t('settings.newPassword') || 'New Password'}
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('settings.newPasswordPlaceholder') || 'Min 8 characters'}
                      className="form-input"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <PasswordStrength password={newPassword} />
                </div>

                <button type="submit" disabled={passwordLoading} className="btn btn-primary settings-save-btn">
                  <Lock size={16} />
                  {passwordLoading ? (t('common.saving') || 'Changing...') : (t('settings.changePassword') || 'Change Password')}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column */}
          <div className="settings-column">
            {/* Appearance */}
            <div className="card settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon appearance">
                  <Palette size={20} />
                </div>
                <div>
                  <h2 className="settings-card-title">{t('settings.themeSection') || 'Appearance'}</h2>
                  <p className="settings-card-desc">{t('settings.themeDesc') || 'Choose your preferred theme'}</p>
                </div>
              </div>

              <div className="settings-theme-grid">
                {([
                  { key: 'light' as Theme, icon: Sun, label: t('settings.themeLight') || 'Light' },
                  { key: 'dark' as Theme, icon: Moon, label: t('settings.themeDark') || 'Dark' },
                  { key: 'system' as Theme, icon: Monitor, label: t('settings.themeSystem') || 'System' },
                ]).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`settings-theme-card ${currentTheme === key ? 'active' : ''}`}
                    onClick={() => handleThemeChange(key)}
                  >
                    <div className="settings-theme-icon">
                      <Icon size={28} />
                    </div>
                    <div className="settings-theme-label">{label}</div>
                    {currentTheme === key && (
                      <div className="settings-theme-check">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="card settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon language">
                  <Globe size={20} />
                </div>
                <div>
                  <h2 className="settings-card-title">{t('settings.languageSection') || 'Language'}</h2>
                  <p className="settings-card-desc">{t('settings.languageDesc') || 'Select your preferred language'}</p>
                </div>
              </div>

              <div className="settings-lang-grid">
                <button
                  type="button"
                  className={`settings-lang-card ${locale === 'en' ? 'active' : ''}`}
                  onClick={() => handleLanguageChange('en')}
                >
                  <div className="settings-lang-info">
                    <div className="settings-lang-name">{t('settings.english') || 'English'}</div>
                    <div className="settings-lang-native">English</div>
                  </div>
                  {locale === 'en' && (
                    <div className="settings-lang-check">
                      <Check size={14} />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  className={`settings-lang-card ${locale === 'ar' ? 'active' : ''}`}
                  onClick={() => handleLanguageChange('ar')}
                >
                  <div className="settings-lang-info">
                    <div className="settings-lang-name">{t('settings.arabic') || 'Arabic'}</div>
                    <div className="settings-lang-native">العربية</div>
                  </div>
                  {locale === 'ar' && (
                    <div className="settings-lang-check">
                      <Check size={14} />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {biometricAvailable && (
              <div className="card settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-icon biometric">
                    <Fingerprint size={20} />
                  </div>
                  <div>
                    <h2 className="settings-card-title">{t('settings.biometricSection') || 'Biometric Login'}</h2>
                    <p className="settings-card-desc">{t('settings.biometricDesc') || 'Sign in with fingerprint or Face ID'}</p>
                  </div>
                </div>

                <div className="settings-biometric-content">
                  {biometricFetching ? (
                    <div className="settings-biometric-loading">
                      <span className="settings-biometric-spinner" />
                      <span>{t('common.loading') || 'Loading...'}</span>
                    </div>
                  ) : biometricCredentials.length > 0 ? (
                    <>
                      <div className="settings-biometric-devices">
                        {biometricCredentials.map((cred) => (
                          <div key={cred.id} className="settings-biometric-device">
                            <div className="settings-biometric-device-icon">
                              <Fingerprint size={18} />
                            </div>
                            <div className="settings-biometric-device-info">
                              <span className="settings-biometric-device-name">{cred.device_name}</span>
                              {cred.last_used_at && (
                                <span className="settings-biometric-device-date">
                                  {t('settings.lastUsed') || 'Last used'}: {new Date(cred.last_used_at).toLocaleDateString()}
                                </span>
                              )}
                              {!cred.last_used_at && cred.created_at && (
                                <span className="settings-biometric-device-date">
                                  {t('settings.registeredOn') || 'Registered'}: {new Date(cred.created_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="settings-biometric-delete-btn"
                              onClick={() => handleBiometricDelete(cred.id)}
                              disabled={deletingId === cred.id}
                              title={t('settings.removeBiometric') || 'Remove'}
                            >
                              {deletingId === cred.id ? <span className="settings-biometric-spinner small" /> : <Trash2 size={15} />}
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleBiometricRegister}
                        disabled={biometricLoading}
                        className="settings-biometric-add-btn"
                      >
                        <Fingerprint size={15} />
                        {biometricLoading ? (t('common.loading') || 'Setting up...') : (t('settings.addBiometric') || 'Add another device')}
                      </button>
                    </>
                  ) : (
                    <div className="settings-biometric-empty">
                      <div className="settings-biometric-empty-icon">
                        <Fingerprint size={32} />
                      </div>
                      <p className="settings-biometric-empty-text">{t('settings.noBiometric') || 'No biometric credentials registered'}</p>
                      <button
                        type="button"
                        onClick={handleBiometricRegister}
                        disabled={biometricLoading}
                        className="btn btn-primary settings-save-btn"
                      >
                        <Fingerprint size={16} />
                        {biometricLoading ? (t('common.loading') || 'Setting up...') : (t('settings.enableBiometric') || 'Enable Biometric Login')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <DangerZone />

      </div>
    </Layout>
  );
}

function DangerZone() {
  const { t } = useTranslations();
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ txns: number; stmts: number } | null>(null);
  const MAGIC = t('settings.dangerConfirmPhrase');

  const handleClear = async () => {
    if (confirm !== MAGIC) return;
    setLoading(true);
    try {
      const res = await api.post('/chat/send/', {
        message: 'صفّر كل البيانات — امسح كل المعاملات والكشوفات',
      });
      const actions: Array<Record<string, unknown>> = res.data?.actions ?? [];
      const cleared = actions.find((a) => a.type === 'data_cleared');
      setDone({
        txns: (cleared?.transactions_deleted as number) ?? 0,
        stmts: (cleared?.statements_deleted as number) ?? 0,
      });
      toast.success(t('settings.dangerCleared'));
    } catch {
      toast.error(t('settings.dangerError'));
    } finally {
      setLoading(false);
      setConfirm('');
    }
  };

  return (
    <div className="settings-section" style={{ borderColor: 'var(--danger)', marginTop: 'var(--space-6)' }}>
      <div className="settings-section-header" style={{ color: 'var(--danger)' }}>
        <AlertTriangle size={18} />
        <h2 className="settings-section-title" style={{ color: 'var(--danger)' }}>{t('settings.dangerZone')}</h2>
      </div>
      <div className="settings-section-content">
        {done ? (
          <div style={{ padding: 'var(--space-4)', background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>{t('settings.dangerSuccess')}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t('settings.dangerSuccessDetail', { txns: done.txns, stmts: done.stmts })}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}
              dangerouslySetInnerHTML={{ __html: t('settings.dangerDesc') }}
            />
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}
              dangerouslySetInnerHTML={{ __html: t('settings.dangerConfirmPrompt', { phrase: MAGIC }) }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder={MAGIC}
                style={{ flex: 1 }}
              />
              <button
                onClick={handleClear}
                disabled={confirm !== MAGIC || loading}
                className="btn"
                style={{ background: 'var(--danger)', color: '#fff', whiteSpace: 'nowrap', opacity: confirm !== MAGIC ? 0.4 : 1 }}
              >
                {loading ? <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> : <Trash2 size={15} />}
                {t('settings.dangerClearBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
