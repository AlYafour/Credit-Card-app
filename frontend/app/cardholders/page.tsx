'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/lib/i18n';
import { Users, Building2, User, CreditCard, Activity, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import { cardholdersAPI, Cardholder } from '../api/cardholders';

function SpendBar({ company, personal }: { company: number; personal: number }) {
  const total = company + personal;
  if (!total) return null;
  const companyPct = (company / total) * 100;
  const personalPct = (personal / total) * 100;
  return (
    <div className="ch-spend-bar">
      <div className="ch-spend-fill ch-spend-company" style={{ width: `${companyPct}%` }} />
      <div className="ch-spend-fill ch-spend-personal" style={{ width: `${personalPct}%` }} />
    </div>
  );
}

function CardholderCard({ ch, t }: { ch: Cardholder; t: (k: string) => string }) {
  const router = useRouter();
  const initials = ch.cardholder_name
    ? ch.cardholder_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (ch.card_last_four ?? '??');

  return (
    <div className="card ch-card">
      <div className="ch-card-top">
        <div
          className="ch-avatar"
          style={{ background: ch.color_hex ?? 'var(--primary)' }}
        >
          {initials}
        </div>
        <div className="ch-info">
          <div className="ch-name">
            {ch.cardholder_name ?? <span style={{ fontStyle: 'italic', opacity: 0.5 }}>{t('noName')}</span>}
          </div>
          <div className="ch-card-meta">
            <CreditCard size={12} />
            <span>{ch.bank_name} •••• {ch.card_last_four}</span>
            <span className="ch-ownership-badge">{ch.card_ownership}</span>
          </div>
        </div>
        <div className="ch-monthly">
          <div className="ch-monthly-amount">
            {ch.monthly_spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="ch-monthly-label">AED {t('monthlySpent')}</div>
        </div>
      </div>

      <div className="ch-breakdown">
        <div className="ch-breakdown-item ch-company">
          <div className="ch-breakdown-label">
            <Building2 size={11} /> {t('companySpent')}
          </div>
          <div className="ch-breakdown-value">
            {ch.company_spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} AED
          </div>
        </div>
        <div className="ch-breakdown-item ch-personal">
          <div className="ch-breakdown-label">
            <User size={11} /> {t('personalSpent')}
          </div>
          <div className="ch-breakdown-value">
            {ch.personal_spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} AED
          </div>
        </div>
        <div className="ch-breakdown-item">
          <div className="ch-breakdown-label">
            <Activity size={11} /> {t('transactions')}
          </div>
          <div className="ch-breakdown-value">{ch.transaction_count}</div>
        </div>
      </div>

      <SpendBar company={ch.company_spent} personal={ch.personal_spent} />

      <div className="ch-card-footer">
        <span className="ch-last-activity">
          {ch.last_activity
            ? `${t('lastActivity')}: ${new Date(ch.last_activity).toLocaleDateString('ar-AE')}`
            : '—'}
        </span>
        <button
          onClick={() => router.push(`/transactions?card_id=${ch.card_id}`)}
          className="btn btn-ghost"
          style={{ padding: '4px 10px', fontSize: 12 }}
        >
          <ExternalLink size={12} />
          {t('viewTransactions')}
        </button>
      </div>
    </div>
  );
}

export default function CardholdersPage() {
  const { t } = useTranslations('cardholders');
  const [cardholders, setCardholders] = useState<Cardholder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cardholdersAPI.list()
      .then(setCardholders)
      .catch(() => toast.error('Failed to load cardholders'))
      .finally(() => setLoading(false));
  }, []);

  const totalMonthly = cardholders.reduce((s, c) => s + c.monthly_spent, 0);
  const totalCompany = cardholders.reduce((s, c) => s + c.company_spent, 0);
  const totalPersonal = cardholders.reduce((s, c) => s + c.personal_spent, 0);

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon">
              <Users size={28} />
            </div>
            <div className="page-header-text">
              <h1>{t('title')}</h1>
              <p className="page-subtitle">{t('subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && (
          <>
            {/* Summary strip */}
            {cardholders.length > 0 && (
              <div className="ch-summary-row mb-6">
                {[
                  { label: t('monthlySpent'), value: totalMonthly, icon: <Users size={20} />, color: 'var(--primary)' },
                  { label: t('companySpent'), value: totalCompany, icon: <Building2 size={20} />, color: '#3b82f6' },
                  { label: t('personalSpent'), value: totalPersonal, icon: <User size={20} />, color: '#10b981' },
                ].map(item => (
                  <div key={item.label} className="card ch-summary-card">
                    <div className="basket-summary-icon" style={{ color: item.color, background: `${item.color}18` }}>
                      {item.icon}
                    </div>
                    <div>
                      <div className="basket-summary-label">{item.label}</div>
                      <div className="basket-summary-value">
                        {item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        <span className="basket-summary-currency"> AED</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {cardholders.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Users size={40} style={{ margin: '0 auto 12px', color: 'var(--text-secondary)', opacity: 0.4 }} />
                <p style={{ fontWeight: 600, color: 'var(--text)' }}>{t('noCardholders')}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>{t('noCardholdersDesc')}</p>
              </div>
            ) : (
              <div className="ch-grid">
                {cardholders.map(ch => (
                  <CardholderCard key={ch.card_id} ch={ch} t={t} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
