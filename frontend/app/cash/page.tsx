'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { formatAmount } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import FormattedNumberInput from '@/components/ui/FormattedNumberInput';
import { useAuthStore } from '@/app/store/authStore';
import { cashAPI } from '@/app/api/cash';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';
import type { CashEntry, CashEntryCreateRequest } from '@/types';
import {
  Banknote, Plus, TrendingUp, TrendingDown, Trash2, X,
  RefreshCw, Wallet,
} from 'lucide-react';

export default function CashPage() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t, locale } = useTranslations();
  const ar = locale === 'ar';

  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [balanceCurrency, setBalanceCurrency] = useState<string>('AED');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  // Form
  const [entryType, setEntryType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!isAuthenticated) loadUser().catch(() => router.push('/login'));
  }, [isAuthenticated, loadUser, router]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [entriesRes, balanceRes] = await Promise.all([
        cashAPI.list().then(res => res.items || []),
        cashAPI.getBalance(),
      ]);
      setEntries(entriesRes);
      setBalance(balanceRes.balance);
      setBalanceCurrency(balanceRes.currency || 'AED');
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('errors.generic') || 'An error occurred'));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => { if (isAuthenticated) loadData(); }, [isAuthenticated, loadData]);

  const resetForm = () => {
    setEntryType('income');
    setAmount('');
    setCurrency('AED');
    setDescription('');
    setCategory('');
    setEntryDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error(ar ? 'أدخل مبلغاً صحيحاً' : 'Please enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      const data: CashEntryCreateRequest = {
        entry_type: entryType,
        amount: Number(amount),
        currency,
        description: description || undefined,
        category: category || undefined,
        entry_date: entryDate,
      };
      await cashAPI.create(data);
      toast.success(ar ? 'تمت الإضافة بنجاح' : 'Entry added successfully');
      resetForm();
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('errors.generic') || 'An error occurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(ar ? 'هل تريد حذف هذا السجل؟' : 'Are you sure you want to delete this entry?')) return;
    try {
      await cashAPI.delete(id);
      toast.success(ar ? 'تم الحذف' : 'Entry deleted');
      await loadData();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('errors.generic') || 'An error occurred'));
    }
  };

  const filtered = entries.filter(e => filter === 'all' || e.entry_type === filter);
  const totalIncome  = entries.filter(e => e.entry_type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + e.amount, 0);

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div>

        {/* ── Header ── */}
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon">
              <Banknote size={28} />
            </div>
            <div className="page-header-text">
              <h1>{ar ? 'النقد' : 'Cash'}</h1>
              <p className="page-subtitle">
                {ar ? 'تتبع الدخل والمصروفات النقدية' : 'Track your cash income and expenses'}
              </p>
            </div>
            <div className="page-header-actions">
              <button
                onClick={() => { resetForm(); setShowForm(v => !v); }}
                className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`}
              >
                {showForm ? <><X size={18} /><span>{ar ? 'إلغاء' : 'Cancel'}</span></> : <><Plus size={18} /><span>{ar ? 'إضافة سجل' : 'Add Entry'}</span></>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-3 mb-8">
          <div className="summary-card success">
            <div className="summary-content">
              <div className="summary-label">{ar ? 'إجمالي الدخل' : 'Total Income'}</div>
              <div className="summary-value">
                {loading ? '…' : <>{formatAmount(totalIncome)} <span className="summary-currency"><CurrencySymbol code={balanceCurrency} size={18} /></span></>}
              </div>
            </div>
            <div className="summary-icon"><TrendingUp size={26} /></div>
          </div>
          <div className="summary-card danger">
            <div className="summary-content">
              <div className="summary-label">{ar ? 'إجمالي المصروفات' : 'Total Expenses'}</div>
              <div className="summary-value">
                {loading ? '…' : <>{formatAmount(totalExpense)} <span className="summary-currency"><CurrencySymbol code={balanceCurrency} size={18} /></span></>}
              </div>
            </div>
            <div className="summary-icon"><TrendingDown size={26} /></div>
          </div>
          <div className={`summary-card ${balance >= 0 ? 'info' : 'danger'}`}>
            <div className="summary-content">
              <div className="summary-label">{ar ? 'الرصيد الحالي' : 'Current Balance'}</div>
              <div className="summary-value">
                {loading ? '…' : <>{formatAmount(balance)} <span className="summary-currency"><CurrencySymbol code={balanceCurrency} size={18} /></span></>}
              </div>
            </div>
            <div className="summary-icon"><Wallet size={26} /></div>
          </div>
        </div>

        {/* ── Add Entry Form ── */}
        {showForm && (
          <div className="card mb-6">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <Plus size={18} color="var(--primary)" />
              <h3 style={{ margin: 0 }}>{ar ? 'سجل جديد' : 'New Entry'}</h3>
            </div>
            <form onSubmit={handleSubmit}>

              {/* Type toggle */}
              <div className="form-group">
                <label>{ar ? 'نوع السجل' : 'Entry Type'}</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button type="button" onClick={() => setEntryType('income')}
                    className={`btn ${entryType === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}>
                    <TrendingUp size={16} />
                    <span>{ar ? 'دخل' : 'Income'}</span>
                  </button>
                  <button type="button" onClick={() => setEntryType('expense')}
                    className={`btn ${entryType === 'expense' ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ flex: 1 }}>
                    <TrendingDown size={16} />
                    <span>{ar ? 'مصروف' : 'Expense'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-2">
                <div className="form-group">
                  <label>{ar ? 'المبلغ' : 'Amount'} *</label>
                  <FormattedNumberInput value={amount} onChange={v => setAmount(v)} className="form-input" placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>{ar ? 'العملة' : 'Currency'}</label>
                  <SearchableSelect
                    value={currency} onChange={setCurrency}
                    options={['AED', 'USD', 'EUR', 'GBP', 'SAR']}
                    placeholder={t('common.search')} noMatchesText={t('common.noMatches')}
                  />
                </div>
              </div>

              <div className="grid grid-2">
                <div className="form-group">
                  <label>{ar ? 'الوصف' : 'Description'}</label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                    placeholder={ar ? 'أدخل وصفاً…' : 'Enter description…'} />
                </div>
                <div className="form-group">
                  <label>{ar ? 'الفئة' : 'Category'}</label>
                  <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                    placeholder={ar ? 'أدخل فئة…' : 'Enter category…'} />
                </div>
              </div>

              <div className="form-group">
                <label>{ar ? 'التاريخ' : 'Date'}</label>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                <button type="submit" className={`btn ${entryType === 'expense' ? 'btn-danger' : 'btn-primary'}`} disabled={submitting}>
                  {submitting ? (ar ? 'جاري الحفظ…' : 'Saving…') : (ar ? 'حفظ السجل' : 'Save Entry')}
                </button>
                <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="btn btn-secondary">
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Filter + Refresh bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {(['all', 'income', 'expense'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem' }}>
                {f === 'income' && <TrendingUp size={15} />}
                {f === 'expense' && <TrendingDown size={15} />}
                <span>
                  {f === 'all'     ? (ar ? 'الكل'      : 'All')
                  : f === 'income'  ? (ar ? 'الدخل'     : 'Income')
                  :                   (ar ? 'المصروفات' : 'Expenses')}
                </span>
              </button>
            ))}
          </div>
          <button onClick={loadData} className="btn btn-secondary" style={{ marginInlineStart: 'auto' }} title={ar ? 'تحديث' : 'Refresh'}>
            <RefreshCw size={15} />
            <span>{ar ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>

        {/* ── Entries ── */}
        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)', margin: '0 auto var(--space-3)' }} />
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{ar ? 'جاري التحميل…' : 'Loading…'}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '150px' }}>
            <Banknote size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto var(--space-4)', opacity: 0.4 }} />
            <h3 style={{ marginBottom: 'var(--space-2)' }}>
              {ar ? 'لا توجد سجلات' : 'No entries found'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              {ar ? 'ابدأ بإضافة أول سجل نقدي' : 'Start by adding your first cash entry'}
            </p>
            <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary">
              <Plus size={16} /> {ar ? 'إضافة سجل' : 'Add Entry'}
            </button>
          </div>
        ) : (
          <div className="card card-table">
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{ar ? 'النوع' : 'Type'}</th>
                    <th>{ar ? 'الوصف' : 'Description'}</th>
                    <th>{ar ? 'الفئة' : 'Category'}</th>
                    <th>{ar ? 'التاريخ' : 'Date'}</th>
                    <th className="text-right">{ar ? 'المبلغ' : 'Amount'}</th>
                    <th className="text-center">{ar ? 'حذف' : 'Delete'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(entry => {
                    const isIncome = entry.entry_type === 'income';
                    return (
                      <tr key={entry.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isIncome
                              ? <TrendingUp size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                              : <TrendingDown size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                            <span className="transaction-badge" data-type={isIncome ? 'deposit' : 'purchase'} style={{ fontSize: '0.72rem' }}>
                              {isIncome ? (ar ? 'دخل' : 'Income') : (ar ? 'مصروف' : 'Expense')}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>
                            {entry.description || (isIncome ? (ar ? 'دخل' : 'Income') : (ar ? 'مصروف' : 'Expense'))}
                          </span>
                        </td>
                        <td>
                          {entry.category
                            ? <span className="category-badge">{entry.category}</span>
                            : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                          {entry.entry_date}
                        </td>
                        <td className="text-right">
                          <span style={{ fontWeight: 700, color: isIncome ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                            {isIncome ? '+' : '-'}{formatAmount(entry.amount)} <CurrencySymbol code={entry.currency} size={13} />
                          </span>
                        </td>
                        <td className="text-center">
                          <button onClick={() => handleDelete(entry.id)} className="btn-icon btn-icon-danger" title={ar ? 'حذف' : 'Delete'}>
                            <Trash2 size={17} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
