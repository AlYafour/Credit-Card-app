'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/app/store/authStore';
import { useTranslations } from '@/lib/i18n';
import { getErrorMessage } from '@/lib/errors';
import { authAPI } from '@/app/api/auth';
import { CreditCard, Eye, EyeOff, Fingerprint, ArrowLeft, CheckCircle } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const { t } = useTranslations();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  useEffect(() => {
    authAPI.checkBiometricSupport().then(setBiometricAvailable);
  }, []);

  const handleBiometric = async () => {
    if (!email) {
      setError(t('auth.enterEmailFirst') || 'Please enter your email first');
      return;
    }
    setBiometricLoading(true);
    setError('');
    try {
      await authAPI.loginBiometric(email);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('auth.biometricFailed') || 'Biometric login failed'));
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const loginFailedMsg = t('errors.loginFailed');
      const fallback = 'Login failed. Please check your credentials.';
      const errorMessage = getErrorMessage(err, (loginFailedMsg && loginFailedMsg !== 'errors.loginFailed' ? loginFailedMsg : fallback));
      setError(errorMessage);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setForgotError(data.detail || 'Something went wrong. Please try again.');
        return;
      }
      setForgotSuccess(true);
    } catch {
      setForgotError('Network error. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgotPassword = () => {
    setForgotEmail(email);
    setForgotError('');
    setForgotSuccess(false);
    setShowForgotPassword(true);
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotError('');
    setForgotSuccess(false);
  };

  if (showForgotPassword) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <CreditCard size={28} />
            </div>
            <h2 className="auth-title">{t('common.appName') || 'CardVault'}</h2>
            <p className="auth-subtitle">
              {forgotSuccess
                ? (t('auth.forgotPasswordSuccessSubtitle') || 'Check your inbox')
                : (t('auth.forgotPasswordSubtitle') || 'Reset your password')}
            </p>
          </div>

          {forgotSuccess ? (
            <div className="auth-form" style={{ textAlign: 'center' }}>
              <CheckCircle size={48} style={{ color: '#22c55e', margin: '0 auto 16px' }} />
              <p style={{ marginBottom: 24, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {t('auth.forgotPasswordSuccessMsg', { email: forgotEmail }) || `If ${forgotEmail} is registered, you'll receive a password reset link shortly.`}
              </p>
              <button
                type="button"
                className="btn btn-primary btn-full"
                onClick={closeForgotPassword}
              >
                {t('auth.backToSignIn') || 'Back to Sign in'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="auth-form">
              {forgotError && <div className="alert alert-error">{forgotError}</div>}

              <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {t('auth.forgotPasswordDesc') || "Enter the email address for your account and we'll send you a reset link."}
              </p>

              <div className="form-group">
                <label htmlFor="forgot-email" className="form-label">
                  {t('auth.email') || 'Email address'}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder') || 'Enter your email'}
                  className="form-input"
                  autoFocus
                />
              </div>

              <button type="submit" disabled={forgotLoading} className="btn btn-primary btn-full">
                {forgotLoading
                  ? (t('auth.sending') || 'Sending…')
                  : (t('auth.sendResetLink') || 'Send Reset Link')}
              </button>

              <button
                type="button"
                className="btn btn-full"
                style={{ background: 'transparent', border: '1px solid var(--border-color)', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={closeForgotPassword}
              >
                <ArrowLeft size={16} />
                {t('auth.backToSignIn') || 'Back to Sign in'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <CreditCard size={28} />
          </div>
          <h2 className="auth-title">{t('common.appName') || 'CardVault'}</h2>
          <p className="auth-subtitle">{t('auth.signInSubtitle') || 'Sign in to your account'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              {t('auth.email') || 'Email address'}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder') || 'Enter your email'}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              {t('auth.password') || 'Password'}
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder') || 'Enter your password'}
                className="form-input"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, marginTop: -8 }}>
            <button
              type="button"
              onClick={openForgotPassword}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.85rem', color: 'var(--primary-color, #6366f1)', textDecoration: 'underline' }}
            >
              {t('auth.forgotPassword') || 'Forgot password?'}
            </button>
          </div>

          <button type="submit" disabled={isLoading} className="btn btn-primary btn-full">
            {isLoading ? (t('auth.signingIn') || 'Signing in...') : (t('auth.signIn') || 'Sign in')}
          </button>

          {biometricAvailable && (
            <>
              <div className="biometric-divider">
                <span>{t('auth.or') || 'or'}</span>
              </div>
              <button
                type="button"
                onClick={handleBiometric}
                disabled={biometricLoading || isLoading}
                className="btn btn-biometric btn-full"
              >
                <Fingerprint size={20} />
                {biometricLoading
                  ? (t('common.loading') || 'Loading...')
                  : (t('auth.biometricLogin') || 'Sign in with Biometrics')}
              </button>
            </>
          )}

          <p className="auth-footer-text">
            {t('auth.noAccount') || "Don't have an account?"}{' '}
            <Link href="/register" className="auth-link">
              {t('auth.signUp') || 'Sign up'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
