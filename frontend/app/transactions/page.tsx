'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Square
} from 'lucide-react';
import BulkActions from '@/components/BulkActions';
import LoadingState from '@/components/ui/LoadingState';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function TransactionsPage() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t, isRTL } = useTranslations();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string>('all');
  const [transactionType, setTransactionType] = useState<string>('all');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

      try {
        const [cardsRes, transactionsRes] = await Promise.all([
          cardsAPI.list().then((res) => res.items || []),
          transactionsAPI.list({
            card_id: selectedCard !== 'all' ? selectedCard : undefined,
            transaction_type: transactionType !== 'all' ? transactionType : undefined
          }).then((res) => res.items || [])
        ]);
        setCards(cardsRes);
        setTransactions(transactionsRes);
    } catch (err: any) {
        console.error('Error loading data:', err);
      setError(err?.response?.data?.message || t('errors.generic'));
      setTransactions([]);
      setCards([]);
    } finally {
        setLoading(false);
    }
  }, [isAuthenticated, selectedCard, transactionType, t]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, selectedCard, transactionType, loadData]);

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDeleteSingle = async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    try {
      await transactionsAPI.delete(deleteTarget);
      setSelectedTransactions(prev => {
        const next = new Set(prev);
        next.delete(deleteTarget);
        return next;
      });
      await loadData();
      toast.success(t('success.transactionDeleted'));
    } catch (err) {
      console.error('Error deleting transaction:', err);
      toast.error(t('errors.generic'));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedTransactions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedTransactions(new Set(transactions.map(t => t.id)));
  };

  const handleDeselectAll = () => {
    setSelectedTransactions(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedTransactions.size === 0) return;
    setBulkDeleteOpen(true);
  };

  const confirmDeleteBulk = async () => {
    setBulkDeleteOpen(false);
    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedTransactions).map(async (id) => {
        try {
          await transactionsAPI.delete(id);
          return { id, success: true };
        } catch (err: any) {
          // If 404, transaction might already be deleted, treat as success
          if (err?.response?.status === 404) {
            return { id, success: true };
          }
          throw err;
        }
      });

      const results = await Promise.allSettled(deletePromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > 0) {
        toast.error(t('errors.generic') || 'Some transactions could not be deleted');
      } else {
        const deletedCount = selectedTransactions.size;
        setSelectedTransactions(new Set());
        await loadData();
        toast.success(t('success.transactionsDeleted', { count: deletedCount }) || 
          `${deletedCount} transaction(s) deleted successfully`);
      }
    } catch (err) {
      console.error('Error deleting transactions:', err);
      toast.error(t('errors.generic'));
    } finally {
      setDeleting(false);
    }
  };

  if (!isAuthenticated) return null;

  const totalAmount = transactions.reduce((sum, txn) => {
    const isExpense = ['purchase', 'withdrawal', 'payment'].includes(txn.transaction_type);
    return sum + (isExpense ? -Number(txn.amount) : Number(txn.amount));
  }, 0);

  return (
    <Layout>
      <div>
        {/* Header + Action */}
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon">
              <Wallet size={32} />
            </div>
            <div className="page-header-text">
              <h1>{t('transactions.title')}</h1>
              <p className="page-subtitle">{t('transactions.subtitle')}</p>
            </div>
            <div className="page-header-actions">
              <Link href="/sms-parser" className="btn btn-primary">
                <Plus size={18} />
                <span>{t('transactions.addTransaction')}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        {transactions.length > 0 && (
          <div className="summary-card info mb-6">
            <div className="summary-content">
              <div className="summary-label">{t('transactions.totalBalance')}</div>
              <div className="summary-value">
                {totalAmount >= 0 ? '+' : ''}{formatAmount(totalAmount)} <span className="summary-currency"><CurrencySymbol code="AED" size={18} /></span>
              </div>
            </div>
            <div className="summary-icon">
              <Wallet size={28} />
            </div>
            <div className="summary-content text-right">
              <div className="summary-label">{t('transactions.totalTransactions')}</div>
              <div className="summary-value summary-value-sm">
                {transactions.length}
              </div>
            </div>
          </div>
        )}

        {/* Filters Toolbar */}
        <div className="txn-toolbar mb-6">
          <div className="txn-filter-group">
            <div className="txn-filter">
              <label className="txn-filter-label">
                <CreditCard size={14} />
                {t('transactions.filterByCard')}
              </label>
              <SearchableSelect
                value={selectedCard}
                onChange={setSelectedCard}
                options={[t('transactions.allCards'), ...cards.map((c) => `${c.card_name} - ****${c.card_last_four}`)]}
                optionValues={['all', ...cards.map((c) => c.id)]}
                placeholder={t('common.search')}
                noMatchesText={t('common.noMatches')}
                aria-label={t('transactions.filterByCard')}
              />
            </div>
            <div className="txn-filter">
              <label className="txn-filter-label">
                <Filter size={14} />
                {t('transactions.filterByType')}
              </label>
              <SearchableSelect
                value={transactionType}
                onChange={setTransactionType}
                options={[
                  t('transactions.allTypes'),
                  t('transactions.PURCHASE'),
                  t('transactions.REFUND'),
                  t('transactions.REVERSAL'),
                  t('transactions.CARD_PAYMENT'),
                  t('transactions.CASH_WITHDRAWAL'),
                  t('transactions.CASH_ADVANCE'),
                  t('transactions.TRANSFER'),
                  t('transactions.WALLET_TOPUP'),
                  t('transactions.BALANCE_TRANSFER'),
                  t('transactions.INSTALLMENT_PRINCIPAL'),
                  t('transactions.BANK_FEE'),
                  t('transactions.FINANCE_CHARGE'),
                  t('transactions.FOREIGN_EXCHANGE_FEE'),
                  t('transactions.CASHBACK'),
                  t('transactions.REWARD_CREDIT'),
                  t('transactions.CHARGEBACK'),
                  t('transactions.ADJUSTMENT'),
                  t('transactions.PREAUTH_HOLD'),
                  t('transactions.PREAUTH_RELEASE'),
                  t('transactions.QUASI_CASH'),
                  t('transactions.UNKNOWN'),
                ]}
                optionValues={[
                  'all',
                  'purchase',           // legacy DB value
                  'refund',             // legacy DB value
                  'REVERSAL',
                  'payment',            // legacy DB value for CARD_PAYMENT
                  'withdrawal',         // legacy DB value for CASH_WITHDRAWAL
                  'CASH_ADVANCE',
                  'transfer',           // legacy DB value
                  'WALLET_TOPUP',
                  'BALANCE_TRANSFER',
                  'INSTALLMENT_PRINCIPAL',
                  'BANK_FEE',
                  'FINANCE_CHARGE',
                  'FOREIGN_EXCHANGE_FEE',
                  'CASHBACK',
                  'REWARD_CREDIT',
                  'CHARGEBACK',
                  'ADJUSTMENT',
                  'PREAUTH_HOLD',
                  'PREAUTH_RELEASE',
                  'QUASI_CASH',
                  'UNKNOWN',
                ]}
                placeholder={t('common.search')}
                noMatchesText={t('common.noMatches')}
                aria-label={t('transactions.filterByType')}
              />
            </div>
          </div>
          <button
            onClick={loadData}
            className="btn txn-refresh-btn"
            title={t('common.refresh')}
          >
            <RefreshCw size={16} />
            <span>{t('common.refresh')}</span>
          </button>
        </div>

        {/* Bulk Actions Bar */}
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

        {/* Transactions List */}
        {loading ? (
          <div className="card">
            <LoadingState />
          </div>
        ) : error ? (
          <div className="card">
            <ErrorState 
              message={error}
              onRetry={loadData}
            />
          </div>
        ) : transactions.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Wallet}
              title={t('transactions.noTransactions') || 'No Transactions Found'}
              description={t('transactions.noTransactionsDescription') || 'Start by adding your first transaction'}
              action={{
                label: t('transactions.addFirstTransaction') || 'Add First Transaction',
                onClick: () => router.push('/sms-parser')
              }}
            />
          </div>
        ) : (
          <div className="card card-table">
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <button
                        onClick={selectedTransactions.size === transactions.length ? handleDeselectAll : handleSelectAll}
                        className="table-checkbox-btn"
                        title={selectedTransactions.size === transactions.length ? t('common.deselectAll') : t('common.selectAll')}
                      >
                        {selectedTransactions.size === transactions.length ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </th>
                    <th>{t('transactions.date')}</th>
                    <th>{t('transactions.type')}</th>
                    <th>{t('transactions.merchant')}</th>
                    <th>{t('transactions.card')}</th>
                    <th className="text-right">{t('transactions.amount')}</th>
                    <th className="text-center">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => {
                    const card = cards.find(c => c.id === txn.card_id);
                    const isExpense = ['purchase', 'withdrawal', 'payment'].includes(txn.transaction_type);
                    const isSelected = selectedTransactions.has(txn.id);
                    return (
                      <tr key={txn.id} className={isSelected ? 'table-row-selected' : ''}>
                        <td>
                          <button
                            onClick={() => handleToggleSelect(txn.id)}
                            className="table-checkbox-btn"
                            title={isSelected ? t('common.deselect') : t('common.select')}
                          >
                            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>
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
                            {isExpense ? (
                              <TrendingDown size={18} className="transaction-icon-expense" />
                            ) : (
                              <TrendingUp size={18} className="transaction-icon-income" />
                            )}
                            <span className="transaction-badge" data-type={txn.transaction_type}>
                              {t(`transactions.${txn.transaction_type}`)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="transaction-merchant">
                            {txn.merchant_name || txn.description || 'No description'}
                          </div>
                          {txn.description && txn.merchant_name && (
                            <div className="transaction-description">
                              {txn.description}
                            </div>
                          )}
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {txn.category && (
                              <span className="category-badge">
                                {txn.category}
                              </span>
                            )}
                            {(txn as any).expense_type && (txn as any).expense_type !== 'unclassified' && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                                style={{
                                  backgroundColor: (txn as any).expense_type === 'company' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)',
                                  color: (txn as any).expense_type === 'company' ? '#818cf8' : '#34d399',
                                }}
                              >
                                {(txn as any).expense_type === 'company' ? '🏢' : '👤'} {(txn as any).merchant_group_name ?? (txn as any).expense_type}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {card ? (
                            <div className="flex items-center gap-2">
                              <CreditCard size={16} className="text-light" />
                              <span className="transaction-card-name">
                                {card.card_name}
                              </span>
                              <span className="transaction-card-number">
                                ****{card.card_last_four}
                              </span>
                            </div>
                          ) : (
                            <span className="text-light">
                              {t('transactions.cash')}
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <span className="transaction-amount" data-type={txn.transaction_type}>
                            {isExpense ? '-' : '+'}
                          {formatAmount(txn.amount)} <CurrencySymbol code={txn.currency} size={14} />
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => handleDelete(txn.id)}
                            className="btn-icon btn-icon-danger"
                            title={t('common.delete')}
                          >
                            <Trash2 size={18} />
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

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('transactions.deleteTransaction') || 'Delete Transaction'}
        message={t('transactions.deleteConfirm') || 'Are you sure you want to delete this transaction?'}
        confirmLabel={t('common.delete') || 'Delete'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        variant="danger"
        onConfirm={confirmDeleteSingle}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={bulkDeleteOpen}
        title={t('transactions.deleteTransactions') || 'Delete Transactions'}
        message={t('transactions.deleteMultipleConfirm', { count: selectedTransactions.size }) || `Are you sure you want to delete ${selectedTransactions.size} transaction(s)?`}
        confirmLabel={t('common.delete') || 'Delete'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        variant="danger"
        onConfirm={confirmDeleteBulk}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </Layout>
  );
}
