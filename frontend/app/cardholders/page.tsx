'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/lib/i18n';
import { Users, Building2, User, CreditCard, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { cardholdersAPI, Cardholder } from '../api/cardholders';

function SpendBar({ company, personal, total }: { company: number; personal: number; total: number }) {
  if (!total) return null;
  const companyPct = (company / total) * 100;
  const personalPct = (personal / total) * 100;
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden flex mt-2">
      <div className="h-full bg-indigo-500 transition-all" style={{ width: `${companyPct}%` }} />
      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${personalPct}%` }} />
    </div>
  );
}

type TFn = (key: string, params?: Record<string, string | number>) => string;

function CardholderCard({ ch, t }: { ch: Cardholder; t: TFn }) {
  const router = useRouter();
  const initials = ch.cardholder_name
    ? ch.cardholder_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : ch.card_last_four;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: ch.color_hex ?? '#6366f1' }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-white truncate">
                {ch.cardholder_name ?? <span className="text-gray-400 italic">{t('noName')}</span>}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                <CreditCard size={11} />
                <span>{ch.bank_name} •••• {ch.card_last_four}</span>
                <span className="capitalize px-1.5 py-0.5 rounded bg-white/10">{ch.card_ownership}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold text-white">{ch.monthly_spent.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
              <div className="text-xs text-gray-400">AED {t('monthlySpent')}</div>
            </div>
          </div>

          {/* Spend breakdown */}
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div className="bg-indigo-500/10 rounded-lg p-2">
              <div className="flex items-center gap-1 text-indigo-400 mb-0.5">
                <Building2 size={11} />
                <span>{t('companySpent')}</span>
              </div>
              <div className="text-white font-medium">{ch.company_spent.toLocaleString(undefined,{maximumFractionDigits:0})} AED</div>
            </div>
            <div className="bg-emerald-500/10 rounded-lg p-2">
              <div className="flex items-center gap-1 text-emerald-400 mb-0.5">
                <User size={11} />
                <span>{t('personalSpent')}</span>
              </div>
              <div className="text-white font-medium">{ch.personal_spent.toLocaleString(undefined,{maximumFractionDigits:0})} AED</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                <Activity size={11} />
                <span>{t('transactions')}</span>
              </div>
              <div className="text-white font-medium">{ch.transaction_count}</div>
            </div>
          </div>

          <SpendBar company={ch.company_spent} personal={ch.personal_spent} total={ch.company_spent + ch.personal_spent} />

          {/* Footer */}
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-gray-500">
              {ch.last_activity
                ? `${t('lastActivity')}: ${new Date(ch.last_activity).toLocaleDateString()}`
                : '—'}
            </div>
            <button
              onClick={() => router.push(`/transactions?card_id=${ch.card_id}`)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {t('viewTransactions')} →
            </button>
          </div>
        </div>
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        <p className="text-gray-400 mt-1">{t('subtitle')}</p>
      </div>

      {cardholders.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t('monthlySpent'), value: totalMonthly, color: '#6366f1' },
            { label: t('companySpent'), value: totalCompany, color: '#6366f1', icon: <Building2 size={16} /> },
            { label: t('personalSpent'), value: totalPersonal, color: '#10b981', icon: <User size={16} /> },
          ].map(item => (
            <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                {item.icon}
                {item.label}
              </div>
              <div className="text-xl font-bold text-white">
                {item.value.toLocaleString(undefined,{maximumFractionDigits:0})}
                <span className="text-sm text-gray-400 ml-1">AED</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {cardholders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t('noCardholders')}</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">{t('noCardholdersDesc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cardholders.map(ch => (
            <CardholderCard key={ch.card_id} ch={ch} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
