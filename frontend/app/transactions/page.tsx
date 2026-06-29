'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/app/store/authStore';
import { transactionsAPI, Transaction } from '@/app/api/transactions';
import { cardsAPI, Card } from '@/app/api/cards';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { formatAmount } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Calendar,
  CreditCard,
  Wallet,
  RefreshCw,
  Trash2,
  CheckSquare,
  Square,
  FileDown,
  FileUp,
  X,
  ChevronDown,
  Building2,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import BulkActions from '@/components/BulkActions';
import LoadingState from '@/components/ui/LoadingState';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({
  open,
  onClose,
  onSuccess,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  t: (k: string, v?: any) => string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      toast.error('Please upload an .xlsx file');
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await transactionsAPI.importExcel(file);
      toast.success(t('transactions.importSuccess', { created: result.created }));
      if (result.errors.length > 0) {
        toast.error(t('transactions.importErrors', { count: result.errors.length }));
      }
      setFile(null);
      onClose();
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('transactions.importModalTitle')}</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <p className="modal-desc">{t('transactions.importModalDesc')}</p>

        <div
          className={`import-dropzone ${file ? 'has-file' : ''}`}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <FileUp size={32} className="import-dropzone-icon" />
          {file ? (
            <span className="import-file-name">{file.name}</span>
          ) : (
            <span className="import-dropzone-text">{t('transactions.importDropzone')}</span>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!file || uploading}
          >
            {uploading ? t('transactions.importUploading') : t('transactions.importExcel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t, isRTL } = useTranslations();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from URL params (e.g. coming from Baskets page)
  const urlBasketId = searchParams?.get('basket_id') ?? '';

  // Filters
  const [selectedCard, setSelectedCard] = useState<string>('all');
  const [transactionType, setTransactionType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [merchantSearch, setMerchantSearch] = useState('');
  const [expenseType, setExpenseType] = useState('all');
  const [basketId, setBasketId] = useState(urlBasketId);
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sort, setSort] = useState('-transaction_date');
  const [showFilters, setShowFilters] = useState(!!urlBasketId);

  // Selection & delete
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const activeFilterCount = [
    selectedCard !== 'all',
    transactionType !== 'all',
    startDate,
    endDate,
    merchantSearch,
    expenseType !== 'all',
    basketId,
    amountMin,
    amountMax,
    sort !== '-transaction_date',
  ].filter(Boolean).length;

  useEffect(() => {
    if (!isAuthenticated) loadUser().catch(() => router.push('/login'));
  }, [isAuthenticated, loadUser, router]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [cardsRes, txnsRes] = await Promise.all([
        cardsAPI.list().then(r => r.items || []),
        transactionsAPI.list({
          card_id: selectedCard !== 'all' ? selectedCard : undefined,
          transaction_type: transactionType !== 'all' ? transactionType : undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          merchant_name: merchantSearch || undefined,
          expense_type: expenseType !== 'all' ? expenseType : undefined,
          merchant_group_id: basketId || undefined,
          amount_min: amountMin ? Number(amountMin) : undefined,
          amount_max: amountMax ? Number(amountMax) : undefined,
          sort,
        }).then(r => r.items || []),
      ]);
      setCards(cardsRes);
      setTransactions(txnsRes);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('errors.generic'));
      setTransactions([]);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, selectedCard, transactionType, startDate, endDate, merchantSearch, expenseType, basketId, amountMin, amountMax, sort, t]);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, loadData]);

  const handleClearFilters = () => {
    setSelectedCard('all');
    setTransactionType('all');
    setStartDate('');
    setEndDate('');
    setMerchantSearch('');
    setExpenseType('all');
    setBasketId('');
    setAmountMin('');
    setAmountMax('');
    setSort('-transaction_date');
  };

  const handleExport = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const url = transactionsAPI.exportExcel({
      card_id: selectedCard !== 'all' ? selectedCard : undefined,
      transaction_type: transactionType !== 'all' ? transactionType : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      merchant_name: merchantSearch || undefined,
      expense_type: expenseType !== 'all' ? expenseType : undefined,
      merchant_group_id: basketId || undefined,
    });
    // Create a temporary link with auth header via fetch
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'transactions.xlsx';
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Export failed'));
  };

  const handleDelete = (id: string) => setDeleteTarget(id);

  const confirmDeleteSingle = async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    try {
      await transactionsAPI.delete(deleteTarget);
      setSelectedTransactions(prev => { const n = new Set(prev); n.delete(deleteTarget); return n; });
      await loadData();
      toast.success(t('success.transactionDeleted'));
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedTransactions(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const handleSelectAll = () => setSelectedTransactions(new Set(transactions.map(t => t.id)));
  const handleDeselectAll = () => setSelectedTransactions(new Set());
  const handleDeleteSelected = () => { if (selectedTransactions.size) setBulkDeleteOpen(true); };

  const confirmDeleteBulk = async () => {
    setBulkDeleteOpen(false);
    setDeleting(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedTransactions).map(id =>
          transactionsAPI.delete(id).catch((err: any) => {
            if (err?.response?.status === 404) return;
            throw err;
          })
        )
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed) toast.error(t('errors.generic'));
      else {
        const count = selectedTransactions.size;
        setSelectedTransactions(new Set());
        await loadData();
        toast.success(t('success.transactionsDeleted', { count }) || `${count} deleted`);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setDeleting(false);
    }
  };

  if (!isAuthenticated) return null;

  const totalAmount = transactions.reduce((s, txn) => {
    const isExp = ['purchase', 'withdrawal', 'payment'].includes(txn.transaction_type);
    return s + (isExp ? -Number(txn.amount) : Number(txn.amount));
  }, 0);

  const totalExpenses = transactions
    .filter(txn => ['purchase', 'withdrawal', 'payment'].includes(txn.transaction_type))
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <Layout>
      <div>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon"><Wallet size={32} /></div>
            <div className="page-header-text">
              <h1>{t('transactions.title')}</h1>
              <p className="page-subtitle">{t('transactions.subtitle')}</p>
            </div>
            <div className="page-header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setImportOpen(true)}
                className="btn btn-ghost"
                title={t('transactions.importExcel')}
              >
                <FileUp size={16} />
                <span>{t('transactions.importExcel')}</span>
              </button>
              <button
                onClick={handleExport}
                className="btn btn-ghost"
                title={t('transactions.exportExcel')}
              >
                <FileDown size={16} />
                <span>{t('transactions.exportExcel')}</span>
              </button>
              <Link href="/sms-parser" className="btn btn-primary">
                <Plus size={18} />
                <span>{t('transactions.addTransaction')}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────── */}
        {transactions.length > 0 && (
          <div className="txn-summary-row mb-6">
            <div className="txn-summary-card">
              <div className="txn-summary-label">{t('transactions.totalTransactions')}</div>
              <div className="txn-summary-value">{transactions.length}</div>
            </div>
            <div className="txn-summary-card">
              <div className="txn-summary-label">{t('transactions.totalBalance')}</div>
              <div className={`txn-summary-value ${totalAmount >= 0 ? 'positive' : 'negative'}`}>
                {totalAmount >= 0 ? '+' : ''}{formatAmount(Math.abs(totalAmount))} AED
              </div>
            </div>
            <div className="txn-summary-card">
              <div className="txn-summary-label">Total Expenses</div>
              <div className="txn-summary-value negative">-{formatAmount(totalExpenses)} AED</div>
            </div>
          </div>
        )}

        {/* ── Filter Bar ──────────────────────────────────────────────── */}
        <div className="filter-bar mb-4">
          <div className="filter-bar-top">
            {/* Quick: Card + Type */}
            <div className="filter-quick-group">
              <div className="filter-item">
                <label className="filter-label">
                  <CreditCard size={13} />
                  {t('transactions.filterByCard')}
                </label>
                <SearchableSelect
                  value={selectedCard}
                  onChange={setSelectedCard}
                  options={[t('transactions.allCards'), ...cards.map(c => `${c.card_name} ****${c.card_last_four}`)]}
                  optionValues={['all', ...cards.map(c => c.id)]}
                  placeholder={t('common.search')}
                  noMatchesText={t('common.noMatches')}
                />
              </div>
              <div className="filter-item">
                <label className="filter-label">
                  <Filter size={13} />
                  {t('transactions.filterByType')}
                </label>
                <SearchableSelect
                  value={transactionType}
                  onChange={setTransactionType}
                  options={[
                    t('transactions.allTypes'),
                    t('transactions.PURCHASE'), t('transactions.REFUND'), t('transactions.REVERSAL'),
                    t('transactions.CARD_PAYMENT'), t('transactions.CASH_WITHDRAWAL'), t('transactions.CASH_ADVANCE'),
                    t('transactions.TRANSFER'), t('transactions.WALLET_TOPUP'), t('transactions.BALANCE_TRANSFER'),
                    t('transactions.INSTALLMENT_PRINCIPAL'), t('transactions.BANK_FEE'), t('transactions.FINANCE_CHARGE'),
                    t('transactions.FOREIGN_EXCHANGE_FEE'), t('transactions.CASHBACK'), t('transactions.REWARD_CREDIT'),
                    t('transactions.CHARGEBACK'), t('transactions.ADJUSTMENT'), t('transactions.PREAUTH_HOLD'),
                    t('transactions.PREAUTH_RELEASE'), t('transactions.QUASI_CASH'), t('transactions.UNKNOWN'),
                  ]}
                  optionValues={[
                    'all', 'purchase', 'refund', 'REVERSAL', 'payment', 'withdrawal', 'CASH_ADVANCE',
                    'transfer', 'WALLET_TOPUP', 'BALANCE_TRANSFER', 'INSTALLMENT_PRINCIPAL', 'BANK_FEE',
                    'FINANCE_CHARGE', 'FOREIGN_EXCHANGE_FEE', 'CASHBACK', 'REWARD_CREDIT', 'CHARGEBACK',
                    'ADJUSTMENT', 'PREAUTH_HOLD', 'PREAUTH_RELEASE', 'QUASI_CASH', 'UNKNOWN',
                  ]}
                  placeholder={t('common.search')}
                  noMatchesText={t('common.noMatches')}
                />
              </div>
            </div>

            {/* Right: toggle + refresh */}
            <div className="filter-bar-actions">
              <button
                className={`btn ${showFilters ? 'btn-primary' : 'btn-ghost'} filter-toggle-btn`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal size={16} />
                <span>{t('transactions.showFilters')}</span>
                {activeFilterCount > 0 && (
                  <span className="filter-badge">{activeFilterCount}</span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button className="btn btn-ghost" onClick={handleClearFilters} title={t('transactions.clearFilters')}>
                  <X size={16} />
                </button>
              )}
              <button className="btn btn-ghost" onClick={loadData} title={t('common.refresh')}>
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Advanced filters panel */}
          {showFilters && (
            <div className="filter-advanced-panel">
              {/* Date range */}
              <div className="filter-item">
                <label className="filter-label">
                  <Calendar size={13} />
                  {t('transactions.startDate')}
                </label>
                <input
                  type="date"
                  className="filter-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="filter-item">
                <label className="filter-label">
                  <Calendar size={13} />
                  {t('transactions.endDate')}
                </label>
                <input
                  type="date"
                  className="filter-input"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>

              {/* Merchant search */}
              <div className="filter-item filter-item-wide">
                <label className="filter-label">
                  <Search size={13} />
                  {t('transactions.merchantSearch')}
                </label>
                <div className="filter-search-wrap">
                  <input
                    type="text"
                    className="filter-input"
                    placeholder={t('transactions.merchantSearch')}
                    value={merchantSearch}
                    onChange={e => setMerchantSearch(e.target.value)}
                  />
                  {merchantSearch && (
                    <button className="filter-clear-btn" onClick={() => setMerchantSearch('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expense type */}
              <div className="filter-item">
                <label className="filter-label">
                  {expenseType === 'company' ? <Building2 size={13} /> : <User size={13} />}
                  {t('transactions.expenseType')}
                </label>
                <select
                  className="filter-select"
                  value={expenseType}
                  onChange={e => setExpenseType(e.target.value)}
                >
                  <option value="all">{t('transactions.allExpenseTypes')}</option>
                  <option value="company">{t('transactions.company')}</option>
                  <option value="personal">{t('transactions.personal')}</option>
                  <option value="unclassified">{t('transactions.unclassified')}</option>
                </select>
              </div>

              {/* Amount range */}
              <div className="filter-item">
                <label className="filter-label">{t('transactions.amountMin')}</label>
                <input
                  type="number"
                  className="filter-input no-rtl"
                  placeholder="0"
                  value={amountMin}
                  min="0"
                  onChange={e => setAmountMin(e.target.value)}
                />
              </div>
              <div className="filter-item">
                <label className="filter-label">{t('transactions.amountMax')}</label>
                <input
                  type="number"
                  className="filter-input no-rtl"
                  placeholder="∞"
                  value={amountMax}
                  min="0"
                  onChange={e => setAmountMax(e.target.value)}
                />
              </div>

              {/* Sort */}
              <div className="filter-item">
                <label className="filter-label">
                  <ChevronDown size={13} />
                  {t('transactions.sortBy')}
                </label>
                <select className="filter-select" value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="-transaction_date">{t('transactions.sortNewest')}</option>
                  <option value="transaction_date">{t('transactions.sortOldest')}</option>
                  <option value="-amount">{t('transactions.sortHighest')}</option>
                  <option value="amount">{t('transactions.sortLowest')}</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ── Bulk Actions ────────────────────────────────────────────── */}
        {selectedTransactions.size > 0 && (
          <BulkActions
            selectedItems={selectedTransactions}
            totalItems={transactions.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onDeleteSelected={handleDeleteSelected}
            itemName="transaction"
            isLoading={deleting}
          />
        )}

        {/* ── Table ───────────────────────────────────────────────────── */}
        {loading ? (
          <div className="card"><LoadingState /></div>
        ) : error ? (
          <div className="card"><ErrorState message={error} onRetry={loadData} /></div>
        ) : transactions.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Wallet}
              title={t('transactions.noTransactions') || 'No Transactions Found'}
              description={t('transactions.noTransactionsDescription')}
              action={{ label: t('transactions.addFirstTransaction'), onClick: () => router.push('/sms-parser') }}
            />
          </div>
        ) : (
          <div className="card card-table">
            <div className="txn-table-wrap">
              <table className="txn-table">
                <thead>
                  <tr>
                    <th className="col-check">
                      <button
                        onClick={selectedTransactions.size === transactions.length ? handleDeselectAll : handleSelectAll}
                        className="table-checkbox-btn"
                      >
                        {selectedTransactions.size === transactions.length ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </th>
                    <th className="col-date">{t('transactions.date')}</th>
                    <th className="col-type">{t('transactions.type')}</th>
                    <th className="col-merchant">{t('transactions.merchant')}</th>
                    <th className="col-card">{t('transactions.card')}</th>
                    <th className="col-amount text-right">{t('transactions.amount')}</th>
                    <th className="col-actions text-center">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(txn => {
                    const card = cards.find(c => c.id === txn.card_id);
                    const isExpense = ['purchase', 'withdrawal', 'payment'].includes(txn.transaction_type);
                    const isSelected = selectedTransactions.has(txn.id);
                    const expType = (txn as any).expense_type;
                    const groupName = (txn as any).merchant_group_name;
                    return (
                      <tr key={txn.id} className={isSelected ? 'table-row-selected' : ''}>
                        <td className="col-check">
                          <button onClick={() => handleToggleSelect(txn.id)} className="table-checkbox-btn">
                            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>
                        <td className="col-date">
                          <div className="txn-date-cell">
                            <span className="txn-date">{format(new Date(txn.transaction_date), 'MMM dd, yyyy')}</span>
                            <span className="txn-time">{format(new Date(txn.transaction_date), 'HH:mm')}</span>
                          </div>
                        </td>
                        <td className="col-type">
                          <div className="txn-type-cell">
                            {isExpense
                              ? <TrendingDown size={16} className="transaction-icon-expense" />
                              : <TrendingUp size={16} className="transaction-icon-income" />}
                            <span className="transaction-badge" data-type={txn.transaction_type}>
                              {t(`transactions.${txn.transaction_type}`)}
                            </span>
                          </div>
                        </td>
                        <td className="col-merchant">
                          <div className="txn-merchant-name">
                            {txn.merchant_name || txn.description || '—'}
                          </div>
                          {txn.description && txn.merchant_name && (
                            <div className="txn-merchant-desc">{txn.description}</div>
                          )}
                          <div className="txn-badges">
                            {txn.category && (
                              <span className="category-badge">{txn.category}</span>
                            )}
                            {expType && expType !== 'unclassified' && (
                              <span
                                className="expense-type-badge"
                                data-expense={expType}
                              >
                                {expType === 'company' ? <Building2 size={10} /> : <User size={10} />}
                                {groupName || t(`transactions.${expType}`)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="col-card">
                          {card ? (
                            <div className="txn-card-cell">
                              <CreditCard size={14} className="text-light" />
                              <span className="txn-card-name">{card.card_name}</span>
                              <span className="txn-card-num">****{card.card_last_four}</span>
                            </div>
                          ) : (
                            <span className="text-light">{t('transactions.cash')}</span>
                          )}
                        </td>
                        <td className="col-amount text-right">
                          <span className="transaction-amount" data-type={txn.transaction_type}>
                            {isExpense ? '-' : '+'}{formatAmount(txn.amount)}&nbsp;
                            <CurrencySymbol code={txn.currency} size={13} />
                          </span>
                        </td>
                        <td className="col-actions text-center">
                          <button
                            onClick={() => handleDelete(txn.id)}
                            className="btn-icon btn-icon-danger"
                            title={t('common.delete')}
                          >
                            <Trash2 size={16} />
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

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={loadData}
        t={t}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('transactions.deleteTransaction') || 'Delete Transaction'}
        message={t('transactions.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeleteSingle}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        isOpen={bulkDeleteOpen}
        title={t('transactions.deleteTransactions') || 'Delete Transactions'}
        message={t('transactions.deleteMultipleConfirm', { count: selectedTransactions.size })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeleteBulk}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </Layout>
  );
}
