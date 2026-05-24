'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { cardsAPI } from '@/app/api/cards';
import { formatAmount } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import toast from 'react-hot-toast';
import {
  BarChart3, TrendingDown, TrendingUp, Wallet, CreditCard,
  Calendar, AlertCircle, CheckCircle, Star, Coins, ArrowLeft,
  RefreshCw, ChevronDown, ChevronUp, Edit2, Check, X,
  Clock, Zap, PieChart, Filter, SlidersHorizontal,
} from 'lucide-react';

type Analytics = Awaited<ReturnType<typeof cardsAPI.analytics>>;

const AR_MONTHS: Record<string, string> = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر',
};
const EN_MONTHS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

function fmtDate(iso: string, locale: string) {
  const [y, m, d] = iso.split('-');
  const month = locale === 'ar' ? AR_MONTHS[m] : EN_MONTHS[m];
  return `${d} ${month} ${y}`;
}

function urgencyColor(days: number | null) {
  if (days === null) return 'var(--text-secondary)';
  if (days < 0) return 'var(--danger)';
  if (days <= 5) return 'var(--danger)';
  if (days <= 14) return '#f59e0b';
  return 'var(--success)';
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const { locale } = useTranslations();
  const ar = locale === 'ar';

  const PERIOD_LABELS = ar
    ? { month: 'هذا الشهر', quarter: 'هذا الربع', year: 'هذه السنة', all: 'كل الوقت', custom: 'نطاق مخصص' }
    : { month: 'This Month', quarter: 'This Quarter', year: 'This Year', all: 'All Time', custom: 'Custom Range' };

  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'all' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [cardFilter, setCardFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMonthly, setShowMonthly] = useState(false);

  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editRate, setEditRate] = useState('1');
  const [editFils, setEditFils] = useState('5');
  const [saving, setSaving] = useState(false);

  const [allCards, setAllCards] = useState<Array<{ card_id: string; card_name: string; bank_name: string; last_four: string }>>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof cardsAPI.analytics>[0] = {};
      if (period !== 'custom') {
        params.period = period;
      } else {
        if (fromDate) params.from_date = fromDate;
        if (toDate) params.to_date = toDate;
        params.period = 'custom';
      }
      if (cardFilter) params.card_id = cardFilter;
      if (categoryFilter) params.category = categoryFilter;

      const res = await cardsAPI.analytics(params);
      setData(res);

      if (!cardFilter && !categoryFilter && period === 'all') {
        setAllCards(res.by_card.map(c => ({ card_id: c.card_id, card_name: c.card_name, bank_name: c.bank_name, last_four: c.last_four })));
        setAllCategories(res.by_category.map(c => c.category).filter(Boolean));
      }
    } catch {
      toast.error(ar ? 'فشل تحميل التقارير' : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [period, fromDate, toDate, cardFilter, categoryFilter, ar]);

  useEffect(() => { load(); }, [load]);

  const clearFilters = () => {
    setPeriod('all');
    setFromDate('');
    setToDate('');
    setCardFilter('');
    setCategoryFilter('');
  };

  const hasActiveFilter = period !== 'all' || !!fromDate || !!toDate || !!cardFilter || !!categoryFilter;

  const startEdit = (cardId: string, rate: number, fils: number) => {
    setEditingCard(cardId);
    setEditRate(String(rate));
    setEditFils(String(fils));
  };

  const savePoints = async (cardId: string) => {
    setSaving(true);
    try {
      await cardsAPI.updatePointsRate(cardId, parseFloat(editRate) || 1, parseFloat(editFils) || 5);
      setEditingCard(null);
      await load();
      toast.success(ar ? 'تم الحفظ' : 'Saved');
    } catch {
      toast.error(ar ? 'فشل الحفظ' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return (
    <Layout>
      <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
        <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
        <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>
          {ar ? 'جاري تحميل التقارير…' : 'Loading reports…'}
        </p>
      </div>
    </Layout>
  );

  if (!data) return null;

  const { totals, by_category, by_card, monthly_trend, upcoming_payments, points_summary } = data;
  const maxCat = by_category[0]?.total || 1;
  const maxMonthly = Math.max(...monthly_trend.map(m => m.purchases), 1);
  const totalDue = upcoming_payments.reduce((s, c) => s + c.current_balance, 0);
  const minDue = upcoming_payments.reduce((s, c) => s + c.minimum_payment, 0);

  const periodLabel = period === 'custom' && (fromDate || toDate)
    ? `${fromDate ? fmtDate(fromDate, locale) : '…'} — ${toDate ? fmtDate(toDate, locale) : '…'}`
    : PERIOD_LABELS[period];

  const activeFilterCount = [period !== 'all', !!fromDate || !!toDate, !!cardFilter, !!categoryFilter].filter(Boolean).length;

  return (
    <Layout>
      <div className="page-container">

        {/* ── Header ── */}
        <div className="page-header-section" style={{ marginBottom: 'var(--space-4)' }}>
          <button onClick={() => router.back()} className="btn btn-secondary btn-back">
            <ArrowLeft size={16} /><span>{ar ? 'رجوع' : 'Back'}</span>
          </button>
          <div className="page-header-content">
            <div className="page-header-icon"><BarChart3 size={28} /></div>
            <div className="page-header-text">
              <h1>{ar ? 'التقارير والتحليلات' : 'Reports & Analytics'}</h1>
              <p className="page-subtitle">
                {ar ? `ملخص مالي شامل — ${periodLabel}` : `Financial overview — ${periodLabel}`}
              </p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn ${hasActiveFilter ? 'btn-primary' : 'btn-secondary'}`}
            >
              <SlidersHorizontal size={15} />
              <span>{ar ? 'الفلاتر' : 'Filters'}</span>
              {hasActiveFilter && (
                <span style={{ background: '#fff', color: 'var(--primary)', borderRadius: '50%', width: 17, height: 17, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Filters Panel ── */}
        {showFilters && (
          <div className="card" style={{ marginBottom: 'var(--space-5)', borderColor: 'var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <Filter size={16} color="var(--primary)" />
              <h3 style={{ margin: 0 }}>{ar ? 'فلاتر التقرير' : 'Report Filters'}</h3>
              {hasActiveFilter && (
                <button onClick={clearFilters} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '3px 9px', marginInlineStart: 'auto' }}>
                  <X size={12} /> {ar ? 'مسح الكل' : 'Clear All'}
                </button>
              )}
            </div>

            {/* Period quick-select */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                {ar ? 'الفترة الزمنية' : 'Time Period'}
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {(['month', 'quarter', 'year', 'all', 'custom'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`btn ${period === p ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem' }}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom date range */}
            {period === 'custom' && (
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    {ar ? 'من تاريخ' : 'From Date'}
                  </label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    {ar ? 'إلى تاريخ' : 'To Date'}
                  </label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>
            )}

            {/* Card + Category filter */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  {ar ? 'فلترة بالبطاقة' : 'Filter by Card'}
                </label>
                <select value={cardFilter} onChange={e => setCardFilter(e.target.value)} style={{ width: '100%' }}>
                  <option value="">{ar ? 'كل البطاقات' : 'All Cards'}</option>
                  {allCards.map(c => (
                    <option key={c.card_id} value={c.card_id}>{c.card_name} •••• {c.last_four}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  {ar ? 'فلترة بالفئة' : 'Filter by Category'}
                </label>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: '100%' }}>
                  <option value="">{ar ? 'كل الفئات' : 'All Categories'}</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
                <button onClick={load} disabled={loading} className="btn btn-primary">
                  {loading
                    ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Filter size={14} />}
                  {ar ? 'تطبيق' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Section 1: Financial Overview ── */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
            <Wallet size={18} color="var(--primary)" />
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
              {ar ? `الملخص المالي — ${periodLabel}` : `Financial Summary — ${periodLabel}`}
            </h2>
            {loading && <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)', marginInlineStart: 'auto' }} />}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--space-4)' }}>
            {[
              {
                label: ar ? 'إجمالي المصروفات' : 'Total Expenses',
                value: totals.purchases,
                color: 'var(--danger)',
                icon: <TrendingDown size={16} />,
                desc: ar ? 'مشتريات + سحوبات' : 'Purchases + Withdrawals',
              },
              {
                label: ar ? 'إجمالي المسترد' : 'Total Refunds',
                value: totals.refunds,
                color: 'var(--success)',
                icon: <TrendingUp size={16} />,
                desc: ar ? 'استرداد + كاشباك' : 'Refunds + Cashback',
              },
              {
                label: ar ? 'صافي الإنفاق' : 'Net Spending',
                value: totals.net_spending,
                color: totals.net_spending > 0 ? 'var(--danger)' : 'var(--success)',
                icon: <BarChart3 size={16} />,
                desc: ar ? 'المصروفات ناقص المسترد' : 'Expenses minus Refunds',
              },
              {
                label: ar ? 'إجمالي المدفوع للبنوك' : 'Total Paid to Banks',
                value: totals.payments,
                color: 'var(--primary)',
                icon: <CheckCircle size={16} />,
                desc: ar ? 'دفعات أُرسلت' : 'Payments sent',
              },
              {
                label: ar ? 'الرصيد المتبقي' : 'Remaining Balance',
                value: Math.max(totals.net_after_payments, 0),
                color: '#f59e0b',
                icon: <AlertCircle size={16} />,
                desc: ar ? 'لم يُسدَّد بعد' : 'Unpaid yet',
              },
            ].map(item => (
              <div key={item.label} className="card" style={{ padding: 'var(--space-4)', textAlign: 'center', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: item.color, marginBottom: 6 }}>{item.icon}</div>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', color: item.color, margin: '0 0 2px' }}>
                  {formatAmount(item.value)} <CurrencySymbol code="AED" size={11} />
                </p>
                <p style={{ fontSize: '0.73rem', fontWeight: 600, margin: '0 0 2px' }}>{item.label}</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 2: Upcoming Payments ── */}
        {!cardFilter && upcoming_payments.length > 0 && (
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <Calendar size={18} color="var(--primary)" />
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                {ar ? 'جدول الاستحقاقات القادمة' : 'Upcoming Payments'}
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--danger-bg)', borderColor: 'var(--danger)', textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--danger)', margin: 0 }}>
                  {formatAmount(totalDue)} <CurrencySymbol code="AED" size={11} />
                </p>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {ar ? 'إجمالي المستحق' : 'Total Due'}
                </p>
              </div>
              <div className="card" style={{ padding: 'var(--space-3)', background: '#fef3c7', textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f59e0b', margin: 0 }}>
                  {formatAmount(minDue)} <CurrencySymbol code="AED" size={11} />
                </p>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {ar ? 'الحد الأدنى للدفع' : 'Minimum Payment'}
                </p>
              </div>
              <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--primary-bg)', textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)', margin: 0 }}>
                  {upcoming_payments.length}
                </p>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {ar ? 'بطاقات لها مستحقات' : 'Cards with dues'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {upcoming_payments.map(card => {
                const dColor = urgencyColor(card.days_until);
                const pct = card.credit_limit > 0 ? (card.current_balance / card.credit_limit) * 100 : 0;
                return (
                  <div key={card.card_id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                      <div style={{ width: 38, height: 24, borderRadius: 4, background: card.color_hex || 'var(--primary)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <p style={{ fontWeight: 600, margin: '0 0 2px', fontSize: '0.92rem' }}>{card.card_name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                          {card.bank_name} •••• {card.card_last_four}
                        </p>
                      </div>
                      <div style={{ textAlign: 'end', flexShrink: 0 }}>
                        {card.due_date ? (
                          <>
                            <p style={{ fontWeight: 600, color: dColor, margin: '0 0 2px', fontSize: '0.85rem' }}>
                              {card.is_overdue
                                ? (ar ? '⚠️ متأخر' : '⚠️ Overdue')
                                : card.days_until === 0
                                  ? (ar ? '⚡ اليوم' : '⚡ Today')
                                  : `${card.days_until} ${ar ? 'يوم' : 'days'}`}
                            </p>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                              {fmtDate(card.due_date, locale)}
                            </p>
                          </>
                        ) : (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                            {ar ? 'تاريخ غير محدد' : 'No date set'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{ar ? 'المستحق' : 'Due'}</span>
                        <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                          {formatAmount(card.current_balance)} <CurrencySymbol code={card.currency} size={10} />
                        </span>
                      </div>
                      <MiniBar value={card.current_balance} max={card.credit_limit} color="var(--danger)" />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                        <span>
                          {ar ? 'الحد الأدنى' : 'Min.'}: {formatAmount(card.minimum_payment)}
                        </span>
                        <span>
                          {pct.toFixed(0)}% {ar ? 'من' : 'of'} {formatAmount(card.credit_limit)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Section 3: Points & Rewards ── */}
        {by_card.length > 0 && (
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
              <Star size={18} color="#f59e0b" />
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{ar ? 'النقاط والمكافآت' : 'Points & Rewards'}</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginInlineStart: 'auto' }}>
                {ar ? 'اضغط تعديل لضبط معدل النقاط' : 'Tap Edit to adjust points rate per card'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--primary-bg)', textAlign: 'center' }}>
                <Coins size={20} style={{ color: 'var(--primary)', margin: '0 auto 6px' }} />
                <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--primary)', margin: 0 }}>
                  {points_summary.total_earned.toLocaleString()}
                </p>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {ar ? 'إجمالي النقاط' : 'Total Points'}
                </p>
              </div>
              <div className="card" style={{ padding: 'var(--space-4)', background: '#fef3c7', textAlign: 'center' }}>
                <Zap size={20} style={{ color: '#f59e0b', margin: '0 auto 6px' }} />
                <p style={{ fontWeight: 700, fontSize: '1.2rem', color: '#f59e0b', margin: 0 }}>
                  {formatAmount(points_summary.total_value_aed)} <CurrencySymbol code="AED" size={11} />
                </p>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {ar ? 'قيمة النقاط بالدرهم' : 'Points Value (AED)'}
                </p>
              </div>
              <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--success-bg)', textAlign: 'center' }}>
                <TrendingUp size={20} style={{ color: 'var(--success)', margin: '0 auto 6px' }} />
                <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--success)', margin: 0 }}>
                  {totals.purchases > 0 ? ((points_summary.total_value_aed / totals.purchases) * 100).toFixed(2) : '0'}%
                </p>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {ar ? 'نسبة العائد' : 'Return Rate'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {by_card.map(card => (
                <div key={card.card_id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div style={{ width: 34, height: 22, borderRadius: 3, background: card.color_hex || 'var(--primary)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <p style={{ fontWeight: 600, margin: '0 0 1px', fontSize: '0.88rem' }}>{card.card_name}</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>{card.bank_name} •••• {card.last_four}</p>
                    </div>
                    {editingCard === card.card_id ? (
                      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            {ar ? 'نقطة/درهم' : 'Pts/AED'}
                          </label>
                          <input type="number" value={editRate} onChange={e => setEditRate(e.target.value)}
                            style={{ width: 68, fontSize: '0.82rem', padding: '3px 6px' }} step="0.1" min="0" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            {ar ? 'قيمة النقطة (فلس)' : 'Pt value (fils)'}
                          </label>
                          <input type="number" value={editFils} onChange={e => setEditFils(e.target.value)}
                            style={{ width: 68, fontSize: '0.82rem', padding: '3px 6px' }} step="0.1" min="0" />
                        </div>
                        <button onClick={() => savePoints(card.card_id)} disabled={saving} className="btn btn-primary"
                          style={{ padding: '4px 10px', alignSelf: 'flex-end' }}>
                          <Check size={13} />
                        </button>
                        <button onClick={() => setEditingCard(null)} className="btn btn-secondary"
                          style={{ padding: '4px 8px', alignSelf: 'flex-end' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(card.card_id, card.points_earn_rate, card.points_value_fils)}
                        className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                        <Edit2 size={12} /> {ar ? 'تعديل' : 'Edit'}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                    {[
                      { label: ar ? 'الإنفاق' : 'Spending', value: `${formatAmount(card.total_purchases)} AED`, color: 'var(--danger)' },
                      { label: ar ? 'معدل الكسب' : 'Earn Rate', value: ar ? `${card.points_earn_rate} نقطة/د` : `${card.points_earn_rate} pts/AED`, color: 'var(--text-primary)' },
                      { label: ar ? 'النقاط' : 'Points', value: card.points_earned.toLocaleString(), color: 'var(--primary)' },
                      { label: ar ? 'القيمة' : 'Value', value: `${formatAmount(card.points_value_aed)} AED`, color: '#f59e0b' },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)' }}>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: '0 0 2px' }}>{item.label}</p>
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: item.color, margin: 0 }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section 4: Spending by Category ── */}
        {by_category.length > 0 && (
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <PieChart size={18} color="var(--primary)" />
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                {ar ? 'الإنفاق حسب الفئة' : 'Spending by Category'}
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {by_category.map((cat, idx) => {
                const pct = totals.purchases > 0 ? (cat.total / totals.purchases) * 100 : 0;
                const colors = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2', '#be185d'];
                const color = colors[idx % colors.length];
                return (
                  <div
                    key={cat.category}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}
                    onClick={() => { setCategoryFilter(cat.category === categoryFilter ? '' : cat.category); setShowFilters(true); }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ minWidth: 110, fontSize: '0.85rem', fontWeight: cat.category === categoryFilter ? 700 : 500, color: cat.category === categoryFilter ? color : undefined }}>
                      {cat.category}
                    </span>
                    <MiniBar value={cat.total} max={maxCat} color={color} />
                    <span style={{ minWidth: 88, textAlign: 'end', fontSize: '0.8rem', fontWeight: 600, color }}>{formatAmount(cat.total)}</span>
                    <span style={{ minWidth: 35, textAlign: 'end', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 'var(--space-3)' }}>
              {ar ? '💡 اضغط على أي فئة للفلترة حسبها' : '💡 Click any category to filter by it'}
            </p>
          </div>
        )}

        {/* ── Section 5: Spending by Card ── */}
        {by_card.length > 0 && (
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <CreditCard size={18} color="var(--primary)" />
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                {ar ? 'الإنفاق حسب البطاقة' : 'Spending by Card'}
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {by_card.map(card => {
                const pct = totals.purchases > 0 ? (card.total_purchases / totals.purchases) * 100 : 0;
                const isFiltered = cardFilter === card.card_id;
                return (
                  <div
                    key={card.card_id}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', opacity: cardFilter && !isFiltered ? 0.4 : 1 }}
                    onClick={() => { setCardFilter(isFiltered ? '' : card.card_id); setShowFilters(true); }}
                  >
                    <div style={{ width: 34, height: 22, borderRadius: 3, background: card.color_hex || 'var(--primary)', flexShrink: 0, border: isFiltered ? '2px solid var(--primary)' : undefined }} />
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <p style={{ margin: '0 0 1px', fontWeight: 500, fontSize: '0.85rem' }}>{card.card_name}</p>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {card.bank_name} · {card.count} {ar ? 'معاملة' : 'txn'}
                      </p>
                    </div>
                    <MiniBar value={card.total_purchases} max={by_card[0].total_purchases} color={card.color_hex || 'var(--primary)'} />
                    <div style={{ textAlign: 'end', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>{formatAmount(card.total_purchases)}</p>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{pct.toFixed(0)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 'var(--space-3)' }}>
              {ar ? '💡 اضغط على أي بطاقة للفلترة حسبها' : '💡 Click any card to filter by it'}
            </p>
          </div>
        )}

        {/* ── Section 6: Monthly Trend ── */}
        {monthly_trend.length > 0 && (
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <button
              onClick={() => setShowMonthly(!showMonthly)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 0 }}
            >
              <Clock size={18} color="var(--primary)" />
              <h2 style={{ margin: 0, fontSize: '1.05rem', flex: 1, textAlign: 'start' }}>
                {ar ? 'الاتجاه الشهري (آخر 12 شهر)' : 'Monthly Trend (Last 12 Months)'}
              </h2>
              {showMonthly ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showMonthly && (
              <div style={{ marginTop: 'var(--space-4)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 400 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)' }}>{ar ? 'الشهر' : 'Month'}</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'end', color: 'var(--danger)' }}>{ar ? 'المصروفات' : 'Expenses'}</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'end', color: 'var(--primary)' }}>{ar ? 'الدفعات' : 'Payments'}</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'end', color: 'var(--success)' }}>{ar ? 'الاسترداد' : 'Refunds'}</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'end' }}>{ar ? 'الرسم' : 'Chart'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(monthly_trend).reverse().map(row => {
                      const [y, m] = row.month.split('-');
                      return (
                        <tr key={row.month} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: 'var(--space-2)', fontWeight: 500 }}>
                            {ar ? AR_MONTHS[m] : EN_MONTHS[m]} {y}
                          </td>
                          <td style={{ padding: 'var(--space-2)', textAlign: 'end', color: 'var(--danger)', fontWeight: 600 }}>{formatAmount(row.purchases)}</td>
                          <td style={{ padding: 'var(--space-2)', textAlign: 'end', color: 'var(--primary)' }}>{row.payments > 0 ? formatAmount(row.payments) : '—'}</td>
                          <td style={{ padding: 'var(--space-2)', textAlign: 'end', color: 'var(--success)' }}>{row.refunds > 0 ? formatAmount(row.refunds) : '—'}</td>
                          <td style={{ padding: 'var(--space-2)', textAlign: 'end' }}>
                            <div style={{ display: 'inline-block', width: 60, height: 4, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: 'var(--danger)', width: `${Math.min((row.purchases / maxMonthly) * 100, 100)}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
