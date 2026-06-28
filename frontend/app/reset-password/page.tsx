'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CreditCard, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslations();

  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t('auth.invalidResetLink') || 'Invalid reset link. Please request a new password reset.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('auth.passwordMinLength') || 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch') || 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
      const res = await fetch(`${apiUrl}/auth/reset-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || t('errors.generic') || 'Something went wrong. Please try again.');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch {
      setError(t('errors.networkError') || 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <CheckCircle size={56} style={{ color: '#22c55e', margin: '0 auto 16px' }} />
          <h2 className="auth-title">{t('auth.passwordResetTitle') || 'Password Reset!'}</h2>
          <p className="auth-subtitle" style={{ marginBottom: 24 }}>
            {t('auth.passwordResetSuccessMsg') || 'Your password has been updated successfully. Redirecting you to login…'}
          </p>
          <Link href="/login" className="btn btn-primary btn-full">
            {t('auth.goToLogin') || 'Go to Login'}
          </Link>
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
          <p className="auth-subtitle">{t('auth.chooseNewPassword') || 'Choose a new password'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <XCircle size={16} />
              {error}
            </div>
          )}

          {!token && (
            <p style={{ textAlign: 'center', marginTop: 8 }}>
              <Link href="/login" className="auth-link">
                {t('auth.backToLogin') || 'Back to Login'}
              </Link>
            </p>
          )}

          {token && (
            <>
              <div className="form-group">
                <label htmlFor="new-password" className="form-label">
                  {t('auth.newPassword') || 'New Password'}
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.newPasswordPlaceholder') || 'At least 8 characters'}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirm-password" className="form-label">
                  {t('auth.confirmPassword') || 'Confirm New Password'}
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.confirmPasswordPlaceholder') || 'Repeat your password'}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirm(!showConfirm)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="btn btn-primary btn-full">
                {isLoading
                  ? (t('auth.resetting') || 'Resetting…')
                  : (t('auth.resetPassword') || 'Reset Password')}
              </button>
            </>
          )}

          <p className="auth-footer-text">
            {t('auth.rememberPassword') || 'Remember your password?'}{' '}
            <Link href="/login" className="auth-link">
              {t('auth.signIn') || 'Sign in'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <p className="auth-subtitle">{' '}</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
