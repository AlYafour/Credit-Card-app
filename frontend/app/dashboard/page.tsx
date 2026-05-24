'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/app/store/authStore';
import { transactionsAPI } from '@/app/api/transactions';
import { cardsAPI } from '@/app/api/cards';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { formatAmount, formatPercent } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import toast from 'react-hot-toast';
import type { Transaction, MonthlySummary, MonthlyChartData } from '@/types';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowRight,
  Receipt,
  CreditCard,
  BarChart3,
  ArrowUpRight,
  CalendarClock,
} from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = ['#6B2C91', '#8B4FA8', '#0D9488', '#C2410C', '#D97706', '#A855C7', '#9333EA', '#7C3AED'];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loadUser } = useAuthStore();
  const { t } = useTranslations();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [billing, setBilling] = useState<{
    items: Array<{
      id: string; card_name: string; bank_name: string; card_last_four: string;
      credit_limit: number; current_balance: number; available_credit: number;
      payment_due_date: number | null;
      minimum_payment: number | null; currency: string;
    }>;
    total_owed: number; total_credit_limit: number; total_available: number; currency: string;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => {
        toast.error(t('errors.unauthorized'));
        router.push('/login');
      });
    }
  }, [isAuthenticated, loadUser, router, t]);

  useEffect(() => {
    if (isAuthenticated) {
      Promise.all([
        transactionsAPI.list({ per_page: 100 }).then((res) => {
          setTransactions(res.items || []);
        }).catch(() => {
          setTransactions([]);
        }),
        transactionsAPI.monthlySummary(
          new Date().getFullYear(),
          new Date().getMonth() + 1
        ).then((data) => setSummary(data)).catch(() => {}),
        cardsAPI.billingSummary().then((data) => setBilling(data)).catch(() => {}),
      ]).finally(() => setLoading(false));
    }
  }, [isAuthenticated]);

  const monthlyData = useMemo(() => {
    return transactions.reduce((acc: MonthlyChartData[], txn) => {
      const month = new Date(txn.transaction_date).toLocaleDateString('en-US', { month: 'short' });
      const existing = acc.find(item => item.month === month);
      const isExpense = ['purchase', 'withdrawal'].includes(txn.transaction_type);
      const amount = Number(txn.amount);

      if (existing) {
        if (isExpense) {
          existing.spent += amount;
        } else {
          existing.income += amount;
        }
      } else {
        acc.push({
          month,
          spent: isExpense ? amount : 0,
          income: isExpense ? 0 : amount,
        });
      }
      return acc;
    }, []).sort((a, b) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months.indexOf(a.month) - months.indexOf(b.month);
    });
  }, [transactions]);

  const pieData = useMemo(() => {
    const categoryMap = transactions.reduce((acc: Record<string, number>, txn) => {
      if (['purchase', 'withdrawal'].includes(txn.transaction_type)) {
        const category = txn.category || t('transactions.purchase');
        acc[category] = (acc[category] || 0) + Number(txn.amount);
      }
      return acc;
    }, {});

    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions, t]);

  const stats = useMemo(() => {
    if (transactions.length === 0) return { avgAmount: 0, maxAmount: 0, cardsUsed: 0, topCategory: '-' };

    const amounts = transactions.map(t => Number(t.amount));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const maxAmount = Math.max(...amounts);
    const cardsUsed = new Set(transactions.filter(t => t.card_id).map(t => t.card_id)).size;

    const categoryCount: Record<string, number> = {};
    transactions.forEach(t => {
      const cat = t.category || 'Other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    return { avgAmount, maxAmount, cardsUsed, topCategory };
  }, [transactions]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
      .slice(0, 5);
  }, [transactions]);

  if (!isAuthenticated && loading) {
    return (
      <Layout>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="text-secondary">{t('common.loading')}</p>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon">
              <BarChart3 size={32} />
            </div>
            <div className="page-header-text">
              <h1>{t('dashboard.title')}</h1>
              <p className="page-subtitle">{t('dashboard.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-3 mb-8">
            <div className="summary-card danger">
              <div className="summary-content">
                <div className="summary-label">{t('dashboard.totalSpent')}</div>
                <div className="summary-value">
                  {formatAmount(summary.total_spent ?? 0)} <span className="summary-currency"><CurrencySymbol code={summary.currency || 'AED'} size={18} /></span>
                </div>
              </div>
              <div className="summary-icon">
                <TrendingDown size={24} />
              </div>
            </div>

            <div className="summary-card success">
              <div className="summary-content">
                <div className="summary-label">{t('dashboard.totalIncome')}</div>
                <div className="summary-value">
                  {formatAmount(summary.total_income ?? 0)} <span className="summary-currency"><CurrencySymbol code={summary.currency || 'AED'} size={18} /></span>
                </div>
              </div>
              <div className="summary-icon">
                <TrendingUp size={24} />
              </div>
            </div>

            <div className="summary-card info">
              <div className="summary-content">
                <div className="summary-label">{t('dashboard.net')}</div>
                <div className="summary-value">
                  {formatAmount(summary.net ?? 0)} <span className="summary-currency"><CurrencySymbol code={summary.currency || 'AED'} size={18} /></span>
                </div>
              </div>
              <div className="summary-icon">
                <Wallet size={24} />
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        {transactions.length > 0 && (
          <div className="grid grid-2 mb-8">
            {monthlyData.length > 0 && (
              <div className="card">
                <h3 className="card-section-title-small">{t('dashboard.monthlySpending')}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" stroke="var(--text-secondary)" tick={{ fontSize: '0.75rem', letterSpacing: 'normal' }} />
                    <YAxis stroke="var(--text-secondary)" tick={{ fontSize: '0.75rem', letterSpacing: 'normal' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        color: 'var(--text)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8rem', letterSpacing: 'normal' }} />
                    <Line type="monotone" dataKey="spent" stroke="#DC2626" strokeWidth={2} name={t('dashboard.totalSpent')} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="income" stroke="#059669" strokeWidth={2} name={t('dashboard.totalIncome')} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {pieData.length > 0 && (
              <div className="card">
                <h3 className="card-section-title-small">{t('dashboard.byCategory')}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props) => `${props.name ?? ''} ${formatPercent(((props.percent as number) ?? 0) * 100, 0)}`}
                      outerRadius={80}
                      fill="#888"
                      dataKey="value"
                      style={{ fontSize: '0.75rem', letterSpacing: 'normal' }}
                    >
                      {pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        color: 'var(--text)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Quick Stats */}
        {transactions.length > 0 && (
          <div className="grid grid-4 mb-8">
            <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                {t('dashboard.avgTransaction') || 'Avg Transaction'}
              </p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                {formatAmount(stats.avgAmount)} <span style={{ fontSize: '0.85rem', opacity: 0.6, display: 'inline-flex', alignItems: 'center' }}><CurrencySymbol code="AED" size={14} /></span>
              </p>
            </div>
            <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                {t('dashboard.largestTransaction') || 'Largest Transaction'}
              </p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <ArrowUpRight size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                {formatAmount(stats.maxAmount)} <span style={{ fontSize: '0.85rem', opacity: 0.6, display: 'inline-flex', alignItems: 'center' }}><CurrencySymbol code="AED" size={14} /></span>
              </p>
            </div>
            <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                {t('dashboard.cardsUsed') || 'Cards Used'}
              </p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <CreditCard size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                {stats.cardsUsed}
              </p>
            </div>
            <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                {t('dashboard.topCategory') || 'Top Category'}
              </p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <BarChart3 size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                {stats.topCategory}
              </p>
            </div>
          </div>
        )}

        {/* Billing Overview */}
        {billing && billing.items.length > 0 && (
          <div className="card mb-8">
            <div className="billing-header-row">
              <h3 className="card-section-title-small" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarClock size={18} style={{ flexShrink: 0 }} />
                {t('dashboard.billingOverview') || 'Billing Overview'}
              </h3>
              <div className="billing-total">
                <span className="billing-total-label">{t('dashboard.totalOwed') || 'Total Owed'}:</span>
                <span className="billing-total-amount">
                  {formatAmount(billing.total_owed)} <CurrencySymbol code={billing.currency} size={14} />
                </span>
              </div>
            </div>
            <div className="billing-table-wrapper">
              <table className="billing-table">
                <thead>
                  <tr>
                    <th>{t('cards.cardName') || 'Card'}</th>
                    <th>{t('cards.bankName') || 'Bank'}</th>
                    <th>{t('cards.creditLimit') || 'Credit Limit'}</th>
                    <th>{t('cards.outstanding') || 'Outstanding'}</th>
                    <th>{t('cards.availableCredit') || 'Available'}</th>
                    <th>{t('cards.paymentDueDate') || 'Due Date'}</th>
                    <th>{t('cards.minimumPayment') || 'Min Payment'}</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link href={`/cards/${item.id}`} className="billing-card-link">
                          <span>{item.card_name}</span>
                          <span className="billing-card-digits">****{item.card_last_four}</span>
                        </Link>
                      </td>
                      <td>{item.bank_name}</td>
                      <td>{formatAmount(item.credit_limit)} <CurrencySymbol code={item.currency} size={12} /></td>
                      <td className="billing-balance">
                        {formatAmount(item.current_balance)} <CurrencySymbol code={item.currency} size={12} />
                      </td>
                      <td className="billing-available">
                        {formatAmount(item.available_credit)} <CurrencySymbol code={item.currency} size={12} />
                      </td>
                      <td>
                        {item.payment_due_date ? (
                          <span className="billing-due-badge">
                            <CalendarClock size={14} />
                            {t('cards.dayOfMonth', { day: String(item.payment_due_date) }) || `Day ${item.payment_due_date}`}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {item.minimum_payment != null
                          ? <>{formatAmount(item.minimum_payment)} <CurrencySymbol code={item.currency} size={12} /></>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="billing-total-row">
                    <td colSpan={3} style={{ textAlign: 'end' }}>{t('dashboard.totalOwed') || 'Total Owed'}</td>
                    <td className="billing-balance">
                      {formatAmount(billing.total_owed)} <CurrencySymbol code={billing.currency} size={12} />
                    </td>
                    <td className="billing-available">
                      {formatAmount(billing.total_available)} <CurrencySymbol code={billing.currency} size={12} />
                    </td>
                    <td colSpan={2}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {t('dashboard.totalCreditLimit') || 'Limit'}: {formatAmount(billing.total_credit_limit)} <CurrencySymbol code={billing.currency} size={12} />
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-section-title-small" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={18} style={{ flexShrink: 0 }} />
                {t('dashboard.recentTransactions') || 'Recent Transactions'}
              </h3>
              <Link href="/transactions" className="btn btn-secondary btn-sm">
                {t('common.viewAll') || 'View All'}
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="recent-transactions-list">
              {recentTransactions.map((txn) => {
                const isExpense = ['purchase', 'withdrawal'].includes(txn.transaction_type);
                return (
                  <div key={txn.id} className="recent-transaction-item">
                    <div className="recent-transaction-left">
                      <div className={`recent-transaction-icon ${isExpense ? 'expense' : 'income'}`}>
                        {isExpense ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                      </div>
                      <div>
                        <div className="recent-transaction-merchant">
                          {txn.merchant_name || t(`transactions.${txn.transaction_type}`) || txn.transaction_type}
                        </div>
                        <div className="recent-transaction-date">
                          {new Date(txn.transaction_date).toLocaleDateString()}
                          {txn.card_last_four && (
                            <span className="recent-transaction-card">
                              <CreditCard size={12} /> ****{txn.card_last_four}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`recent-transaction-amount ${isExpense ? 'expense' : 'income'}`}>
                      {isExpense ? '-' : '+'}{formatAmount(txn.amount)} <CurrencySymbol code={txn.currency} size={14} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && transactions.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <Receipt size={48} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
            <h3>{t('transactions.noTransactions') || 'No transactions yet'}</h3>
            <p className="text-secondary" style={{ marginBottom: '1rem' }}>
              {t('transactions.noTransactionsDesc') || 'Start by adding your first transaction'}
            </p>
            <Link href="/sms-parser" className="btn btn-primary">
              {t('navigation.addTransaction') || 'Add Transaction'}
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
