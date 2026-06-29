'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { merchantsAPI, Merchant } from '@/app/api/merchants';
import { transactionsAPI, Transaction } from '@/app/api/transactions';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { formatAmount } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import LoadingState from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { format } from 'date-fns';
import {
  Store,
  ChevronDown,
  ChevronRight,
  Search,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  CreditCard,
  Calendar,
} from 'lucide-react';

export default function MerchantsPage() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t, isRTL } = useTranslations();

  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);
  const [merchantTransactions, setMerchantTransactions] = useState<Record<string, Transaction[]>>({});
  const [loadingTransactions, setLoadingTransactions] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

  const loadMerchants = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await merchantsAPI.list();
      setMerchants(res.items || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    if (isAuthenticated) loadMerchants();
  }, [isAuthenticated, loadMerchants]);

  const toggleMerchant = async (merchantName: string) => {
    if (expandedMerchant === merchantName) {
      setExpandedMerchant(null);
      return;
    }
    setExpandedMerchant(merchantName);
    if (merchantTransactions[merchantName]) return;
    setLoadingTransactions(merchantName);
    try {
      const res = await transactionsAPI.list({ merchant_name: merchantName });
      setMerchantTransactions((prev) => ({ ...prev, [merchantName]: res.items || [] }));
    } catch {
      setMerchantTransactions((prev) => ({ ...prev, [merchantName]: [] }));
    } finally {
      setLoadingTransactions(null);
    }
  };

  const filtered = merchants.filter((m) =>
    m.merchant_name.toLowerCase().includes(search.toLowerCase())
  );

  const expenseTypes = new Set([
    'purchase', 'withdrawal', 'payment',
    'PURCHASE', 'CASH_WITHDRAWAL', 'CASH_ADVANCE', 'BANK_FEE',
    'FINANCE_CHARGE', 'FOREIGN_EXCHANGE_FEE', 'WALLET_TOPUP',
    'BALANCE_TRANSFER', 'INSTALLMENT_PRINCIPAL', 'QUASI_CASH',
  ]);

  const isExpense = (type: string) => expenseTypes.has(type);

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon">
              <Store size={28} />
            </div>
            <div className="page-header-text">
              <h1>{t('merchants.title' as any) || 'Merchants'}</h1>
              <p className="page-subtitle">
                {t('merchants.subtitle' as any) || 'All merchants from your transactions'}
              </p>
            </div>
            <div className="page-header-actions">
              <button onClick={loadMerchants} className="txn-refresh-btn" disabled={loading}>
                <RefreshCw size={16} className={loading ? 'spin' : ''} />
                {t('common.refresh')}
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        {!loading && !error && merchants.length > 0 && (
          <div className="summary-card info mb-6">
            <div className="summary-content">
              <div className="summary-label">
                {t('merchants.totalMerchants' as any) || 'Total Merchants'}
              </div>
              <div className="summary-value">{merchants.length}</div>
            </div>
            <div className="summary-icon">
              <Store size={28} />
            </div>
            <div className="summary-content text-right">
              <div className="summary-label">{t('transactions.totalTransactions')}</div>
              <div className="summary-value summary-value-sm">
                {merchants.reduce((s, m) => s + m.transaction_count, 0)}
              </div>
            </div>
          </div>
        )}

        {/* Search toolbar */}
        {!loading && !error && merchants.length > 0 && (
          <div className="txn-toolbar mb-6">
            <div className="txn-filter-group">
              <div className="txn-filter">
                <label className="txn-filter-label">
                  <Search size={14} />
                  {t('common.search')}
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={t('merchants.searchPlaceholder' as any) || 'Search merchants...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* States */}
        {loading && <LoadingState />}
        {error && <ErrorState message={error} onRetry={loadMerchants} />}

        {!loading && !error && merchants.length === 0 && (
          <div className="card">
            <EmptyState
              icon={Store}
              title={t('merchants.noMerchants' as any) || 'No merchants yet'}
              description={
                t('merchants.noMerchantsDesc' as any) ||
                'Merchants appear here once you add transactions with merchant names'
              }
            />
          </div>
        )}

        {/* Merchants table */}
        {!loading && !error && filtered.length > 0 && (
          <div className="card card-table">
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th>{t('merchants.title' as any) || 'Merchant'}</th>
                    <th>{t('transactions.totalTransactions')}</th>
                    <th>{t('transactions.date')}</th>
                    <th className="text-right">{t('transactions.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((merchant) => {
                    const isOpen = expandedMerchant === merchant.merchant_name;
                    const txns = merchantTransactions[merchant.merchant_name] || [];
                    const isLoadingTxns = loadingTransactions === merchant.merchant_name;

                    return (
                      <>
                        {/* Merchant row */}
                        <tr
                          key={merchant.merchant_name}
                          onClick={() => toggleMerchant(merchant.merchant_name)}
                          style={{ cursor: 'pointer' }}
                          className={isOpen ? 'table-row-selected' : ''}
                        >
                          <td>
                            <span style={{ color: 'var(--text-light)' }}>
                              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <Store size={16} className="text-light" />
                              <span className="transaction-merchant" style={{ marginBottom: 0 }}>
                                {merchant.merchant_name}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="transaction-card-name">
                              {merchant.transaction_count}{' '}
                              {merchant.transaction_count === 1
                                ? t('transactions.transaction')
                                : t('transactions.transactions')}
                            </span>
                          </td>
                          <td>
                            {merchant.last_transaction_date && (
                              <div>
                                <div className="transaction-date">
                                  {format(new Date(merchant.last_transaction_date), 'MMM dd, yyyy')}
                                </div>
                                <div className="transaction-time">
                                  {format(new Date(merchant.last_transaction_date), 'HH:mm')}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="text-right">
                            <span
                              className="transaction-amount"
                              data-type="purchase"
                            >
                              -{formatAmount(merchant.total_amount)}{' '}
                              <CurrencySymbol code="AED" size={13} />
                            </span>
                          </td>
                        </tr>

                        {/* Expanded transactions */}
                        {isOpen && (
                          <tr key={`${merchant.merchant_name}-detail`}>
                            <td
                              colSpan={5}
                              style={{
                                padding: '0 0 0.5rem 0',
                                background: 'var(--bg-subtle, var(--bg-secondary))',
                              }}
                            >
                              {isLoadingTxns ? (
                                <div className="flex items-center gap-2" style={{ padding: '1.25rem 1.5rem', color: 'var(--text-light)' }}>
                                  <RefreshCw size={16} className="spin" />
                                  {t('common.loading')}
                                </div>
                              ) : txns.length === 0 ? (
                                <div style={{ padding: '1.25rem 1.5rem', color: 'var(--text-light)', fontSize: '0.875rem' }}>
                                  {t('transactions.noTransactions')}
                                </div>
                              ) : (
                                <table style={{ background: 'transparent' }}>
                                  <thead>
                                    <tr>
                                      <th>{t('transactions.date')}</th>
                                      <th>{t('transactions.type')}</th>
                                      <th>{t('transactions.merchant')}</th>
                                      <th>{t('transactions.card')}</th>
                                      <th className="text-right">{t('transactions.amount')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {txns.map((txn) => {
                                      const expense = isExpense(txn.transaction_type);
                                      return (
                                        <tr key={txn.id}>
                                          <td>
                                            <div className="flex items-center gap-2">
                                              <Calendar size={16} className="text-light" />
                                              <div>
                                                <div className="transaction-date">
                                                  {format(new Date(txn.transaction_date), 'MMM dd, yyyy')}
                                                </div>
                                                <div className="transaction-time">
                                                  {format(new Date(txn.transaction_date), 'HH:mm')}
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="flex items-center gap-2">
                                              {expense ? (
                                                <TrendingDown size={18} className="transaction-icon-expense" />
                                              ) : (
                                                <TrendingUp size={18} className="transaction-icon-income" />
                                              )}
                                              <span
                                                className="transaction-badge"
                                                data-type={txn.transaction_type}
                                              >
                                                {t(`transactions.${txn.transaction_type}` as any) || txn.transaction_type}
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="transaction-merchant" style={{ marginBottom: 0 }}>
                                              {txn.merchant_name || txn.description || '—'}
                                            </div>
                                            {txn.category && (
                                              <span className="category-badge">{txn.category}</span>
                                            )}
                                          </td>
                                          <td>
                                            {txn.card_name ? (
                                              <div className="flex items-center gap-2">
                                                <CreditCard size={16} className="text-light" />
                                                <span className="transaction-card-name">
                                                  {txn.card_name}
                                                </span>
                                                {txn.card_last_four && (
                                                  <span className="transaction-card-number">
                                                    ****{txn.card_last_four}
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-light">{t('transactions.cash')}</span>
                                            )}
                                          </td>
                                          <td className="text-right">
                                            <span
                                              className="transaction-amount"
                                              data-type={txn.transaction_type}
                                            >
                                              {expense ? '-' : '+'}
                                              {formatAmount(txn.amount)}{' '}
                                              <CurrencySymbol code={txn.currency} size={13} />
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && merchants.length > 0 && (
          <div className="card">
            <EmptyState icon={Search} title={t('common.noMatches')} description="" />
          </div>
        )}
      </div>

      <style jsx global>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
}
