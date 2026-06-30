'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { cardsAPI, Card } from '@/app/api/cards';
import { transactionsAPI, Transaction } from '@/app/api/transactions';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { formatAmount, formatPercent } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  CreditCard as CreditCardIcon,
  TrendingUp,
  TrendingDown,
  Receipt,
  Copy,
  Check,
  Star,
  CheckCircle,
  Upload,
} from 'lucide-react';
import { extractCardId, getCardUrl, translateCategory } from '@/lib/utils';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function CardDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t, locale, isRTL } = useTranslations();
  const [card, setCard] = useState<Card | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

  const loadCardData = useCallback(async () => {
    if (isAuthenticated && params.id) {
      try {
        const cardId = extractCardId(params.id as string);
        const cardData = await cardsAPI.get(cardId, reveal);
        setCard(cardData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading card:', error);
        toast.error(t('errors.generic'));
        setLoading(false);
      }
    }
  }, [isAuthenticated, params.id, reveal, t]);

  const loadTransactions = useCallback(async () => {
    if (isAuthenticated && card?.id) {
      try {
        const response = await transactionsAPI.list({ card_id: card.id });
        setTransactions(response.items || []);
        setTransactionsLoading(false);
      } catch (error) {
        console.error('Error loading transactions:', error);
        setTransactionsLoading(false);
      }
    }
  }, [isAuthenticated, card?.id]);

  useEffect(() => {
    if (isAuthenticated && params.id) {
      loadCardData();
    }
  }, [isAuthenticated, params.id, reveal, loadCardData]);

  useEffect(() => {
    if (card?.id) {
      loadTransactions();
    }
  }, [card?.id, loadTransactions]);

  const refreshData = async () => {
    setLoading(true);
    setTransactionsLoading(true);
    await Promise.all([loadCardData(), loadTransactions()]);
    toast.success(t('common.refreshed'));
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteConfirmOpen(false);
    try {
      await cardsAPI.delete(card!.id);
      toast.success(t('success.cardDeleted'));
      router.push('/cards');
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  };

  const formatCardNumber = (number: string) => {
    return number.replace(/(.{4})/g, '$1  ').trim();
  };

  // Detect chatbot-added cards whose number is a placeholder (all zeros, or zeros + last 4)
  const isPlaceholderNumber = (number: string) => {
    const digits = number.replace(/\s/g, '');
    return /^0+$/.test(digits) || /^0{12}\d{4}$/.test(digits);
  };

  const copyCardNumber = async () => {
    if (!card || !reveal || !card.card_number) {
      // If not revealed, fetch it first
      if (!reveal) {
        setReveal(true);
        // Wait for card data to load
        setTimeout(async () => {
          if (card?.card_number) {
            const cardNumber = card.card_number.replace(/\s/g, '');
            await navigator.clipboard.writeText(cardNumber);
            setCopied(true);
            toast.success(t('common.copied') || 'Card number copied!');
            setTimeout(() => setCopied(false), 2000);
          }
        }, 500);
      }
      return;
    }
    
    const cardNumber = card.card_number.replace(/\s/g, '');
    await navigator.clipboard.writeText(cardNumber);
    setCopied(true);
    toast.success(t('common.copied') || 'Card number copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const getCardColor = () => {
    return 'off-white';
  };

  if (!isAuthenticated || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center loading-container">
          <div className="text-center">
            <div className="loading-spinner loading-center"></div>
            <p className="text-secondary">{t('common.loading')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!card) {
    return (
      <Layout>
        <div className="flex items-center justify-center loading-container">
          <div className="text-center">
            <p className="text-secondary mb-4">{t('errors.notFound')}</p>
            <button
              onClick={() => router.push('/cards')}
              className="btn btn-primary"
            >
              {t('cards.title')}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const isCredit = card.card_type === 'credit';
  const currentBalance = card.current_balance != null ? Number(card.current_balance) : null;
  const creditLimit = card.credit_limit != null ? Number(card.credit_limit) : null;
  const availableBalance = creditLimit != null && currentBalance != null
    ? creditLimit - currentBalance
    : card.available_balance != null ? Number(card.available_balance) : null;
  const usedPercentage = creditLimit && currentBalance != null
    ? (currentBalance / creditLimit) * 100
    : 0;
  const cardColor = getCardColor();

  return (
    <Layout>
      <div className="card-detail-page">
        {/* Page Header */}
        <div className="page-header-section">
          <button
            onClick={() => router.back()}
            className="btn btn-secondary btn-back"
          >
            <ArrowLeft size={16} />
            <span>{t('common.back')}</span>
          </button>
          
          <div className="page-header-content">
            <div className="page-header-icon">
              <CreditCardIcon size={32} />
            </div>
            <div className="page-header-text">
              <h1>{card.card_name}</h1>
              <p className="page-subtitle">{card.bank_name}</p>
            </div>
            <div className="page-header-actions">
              <button
                onClick={() => setReveal(!reveal)}
                className="btn btn-secondary"
                title={reveal ? t('cards.hide') : t('cards.reveal')}
              >
                {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
                <span>{reveal ? t('cards.hide') : t('cards.reveal')}</span>
              </button>
              <button
                onClick={refreshData}
                className="btn btn-secondary btn-icon-only"
                title={t('common.refresh')}
              >
                <RefreshCw size={18} />
              </button>
              <button
                onClick={() => router.push(`/cards/${card.id}/edit`)}
                className="btn btn-primary"
              >
                <Edit size={18} />
                <span>{t('common.edit')}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="card-detail-layout">
          {/* Main Content */}
          <div className="card-detail-main">
            {/* Card Preview */}
            <div className="card-preview-section">
              <div className="credit-card-container">
                <div className={`credit-card ${cardColor} credit-card-detail`}>
                  <div className="credit-card-header">
                    <div>
                      {card.is_favorite && <span className="card-favorite">★</span>}
                      <p className="credit-card-bank">{card.bank_name}</p>
                      <p className="credit-card-name-text">{card.card_name}</p>
                    </div>
                    {card.card_network && (
                      <div className="credit-card-vendor-top">
                        {card.card_network.toLowerCase().includes('visa') && (
                          <div className="card-network-visa">VISA</div>
                        )}
                        {card.card_network.toLowerCase().includes('master') && (
                          <div className="card-network-mastercard"></div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="credit-card-number-wrapper">
                    <div className="credit-card-number">
                      {reveal && card.card_number && !isPlaceholderNumber(card.card_number)
                        ? formatCardNumber(card.card_number)
                        : `****  ****  ****  ${card.card_last_four}`}
                    </div>
                    {reveal && card.card_number && !isPlaceholderNumber(card.card_number) && (
                      <button
                        onClick={copyCardNumber}
                        className="credit-card-copy-btn"
                        title={t('common.copy') || 'Copy card number'}
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    )}
                  </div>

                  <div className="credit-card-info">
                    <div>
                      <p className="credit-card-label">{t('cards.cardholder')}</p>
                      <p className="credit-card-holder">
                        {reveal && card.cardholder_name
                          ? card.cardholder_name
                          : '••••'}
                      </p>
                    </div>
                    <div className="credit-card-expiry">
                      <p className="credit-card-label">{t('cards.expiry')}</p>
                      <p className="credit-card-expiry-value">
                        {reveal && card.expiry_month && card.expiry_year
                          ? `${String(card.expiry_month).padStart(2, '0')}/${card.expiry_year > 100 ? card.expiry_year % 100 : card.expiry_year}`
                          : '**/**'}
                      </p>
                    </div>
                  </div>

                  {reveal && (
                    <div className="credit-card-cvv">
                      {card.card_network && (
                        <div className="credit-card-vendor">
                          {card.card_network.toLowerCase().includes('visa') && (
                            <div className="card-network-visa">VISA</div>
                          )}
                          {card.card_network.toLowerCase().includes('master') && (
                            <div className="card-network-mastercard"></div>
                          )}
                        </div>
                      )}
                      <div className="credit-card-cvv-content">
                        <p className="credit-card-label">CVV</p>
                        <p className="credit-card-cvv-value">
                          {card.cvv || 'N/A'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="card transactions-card">
              <div className="section-header">
                <Receipt size={20} />
                <h2 className="section-title">{t('transactions.title') || 'Transactions'}</h2>
                <span className="transactions-count">{transactions.length}</span>
              </div>

              {transactionsLoading ? (
                <div className="text-center loading-container-small">
                  <div className="loading-spinner loading-center"></div>
                  <p className="text-secondary">{t('common.loading')}</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="empty-transactions">
                  <Receipt size={48} className="empty-state-icon" />
                  <p className="empty-state-text">{t('transactions.noTransactions')}</p>
                </div>
              ) : (
                <div className="transactions-list">
                  {transactions.map((txn) => {
                    const isExpense = ['purchase', 'withdrawal', 'payment'].includes(txn.transaction_type);
                    return (
                      <div key={txn.id} className="transaction-item">
                        <div className="transaction-icon-wrapper">
                          <div className={`transaction-icon ${isExpense ? 'transaction-icon-expense' : 'transaction-icon-income'}`}>
                            {isExpense ? (
                              <TrendingDown size={18} />
                            ) : (
                              <TrendingUp size={18} />
                            )}
                          </div>
                        </div>
                        <div className="transaction-content">
                          <div className="transaction-main">
                            <p className="transaction-merchant">{txn.merchant_name || txn.description || t('transactions.transaction')}</p>
                            <p className={`transaction-amount ${isExpense ? 'transaction-amount-expense' : 'transaction-amount-income'}`}>
                              {isExpense ? '-' : '+'}
                              {formatAmount(txn.amount)} <CurrencySymbol code={txn.currency} size={14} />
                            </p>
                          </div>
                          <div className="transaction-meta">
                            <span className="transaction-badge" data-type={txn.transaction_type}>
                              {t(`transactions.${txn.transaction_type}`) || txn.transaction_type}
                            </span>
                            <span className="transaction-date">{format(new Date(txn.transaction_date), 'MMM dd, yyyy')}</span>
                            {txn.category && (
                              <span className="category-badge">{translateCategory(txn.category, locale)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="card-detail-sidebar">
            {/* Financial Summary */}
            {isCredit && creditLimit && (
              <div className="card sidebar-finance-card">
                <div className="sidebar-finance-row">
                  <span className="sidebar-finance-label">{t('cards.creditLimit')}</span>
                  <span className="sidebar-finance-amount">{formatAmount(creditLimit)} <span className="sidebar-finance-currency"><CurrencySymbol code={card.balance_currency} size={14} /></span></span>
                </div>
                {currentBalance !== null && (
                  <div className="sidebar-finance-row">
                    <span className="sidebar-finance-label">{t('cards.outstanding')}</span>
                    <span className="sidebar-finance-amount sidebar-finance-danger">{formatAmount(currentBalance)} <span className="sidebar-finance-currency"><CurrencySymbol code={card.balance_currency} size={14} /></span></span>
                  </div>
                )}
                {availableBalance !== null && (
                  <div className="sidebar-finance-row">
                    <span className="sidebar-finance-label">{t('cards.available')}</span>
                    <span className="sidebar-finance-amount sidebar-finance-success">{formatAmount(availableBalance)} <span className="sidebar-finance-currency"><CurrencySymbol code={card.balance_currency} size={14} /></span></span>
                  </div>
                )}
                {currentBalance !== null && (
                  <div className="sidebar-usage-section">
                    <div className="sidebar-usage-header">
                      <span className="sidebar-usage-label">{t('cards.creditUsage')}</span>
                      <span className="sidebar-usage-percent">{formatPercent(usedPercentage)}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${Math.min(usedPercentage, 100)}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Card Details Grid */}
            <div className="card sidebar-info-card">
              <h3 className="sidebar-info-title">
                <CreditCardIcon size={18} />
                {t('cards.cardInfo') || 'Card Information'}
              </h3>
              <div className="sidebar-info-grid">
                <div className="sidebar-info-item">
                  <span className="sidebar-info-label">{t('cards.cardType')}</span>
                  <span className="sidebar-info-value">{t(`cards.${card.card_type}`) || card.card_type}</span>
                </div>
                {card.card_network && (
                  <div className="sidebar-info-item">
                    <span className="sidebar-info-label">{t('cards.network')}</span>
                    <span className="sidebar-info-value">{t(`cards.network_${(card.card_network || '').toLowerCase()}`) || card.card_network}</span>
                  </div>
                )}
                {card.statement_date && (
                  <div className="sidebar-info-item">
                    <span className="sidebar-info-label">{t('cards.statementDate')}</span>
                    <span className="sidebar-info-value">{t('cards.dayOfMonth').replace('{day}', String(card.statement_date))}</span>
                  </div>
                )}
                {card.payment_due_date && (
                  <div className="sidebar-info-item">
                    <span className="sidebar-info-label">{t('cards.paymentDue')}</span>
                    <span className="sidebar-info-value">{t('cards.day')} {card.payment_due_date}</span>
                  </div>
                )}
                {card.minimum_payment != null && (
                  <div className="sidebar-info-item">
                    <span className="sidebar-info-label">{t('cards.minimumPayment')}</span>
                    <span className="sidebar-info-value">{card.minimum_payment_percentage != null ? formatPercent(card.minimum_payment_percentage) : <>{formatAmount(card.minimum_payment)} <CurrencySymbol code={card.balance_currency} size={12} /></>}</span>
                  </div>
                )}
                {/* Card Benefits */}
                {card.card_benefits && (() => {
                  try {
                    const benefits: string[] = JSON.parse(card.card_benefits);
                    if (benefits.length > 0) return (
                      <div className="card detail-section">
                        <h3 className="detail-section-title"><Star size={18} /> {t('cards.benefits') || 'Card Benefits'}</h3>
                        <ul className="benefits-list">
                          {benefits.map((b, i) => (
                            <li key={i} className="benefit-item"><CheckCircle size={14} className="benefit-check" /><span>{b}</span></li>
                          ))}
                        </ul>
                      </div>
                    );
                  } catch { /* invalid JSON */ }
                  return null;
                })()}

                {card.notes && (
                  <div className="sidebar-info-item sidebar-info-item-full">
                    <span className="sidebar-info-label">{t('cards.notes')}</span>
                    <span className="sidebar-info-value">{card.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="card sidebar-actions-card">
              <button
                onClick={() => router.push(`/transactions?card_id=${card.id}`)}
                className="btn btn-secondary btn-full"
              >
                <Receipt size={16} />
                {t('cards.viewAllTransactions')}
              </button>
              <button
                onClick={() => router.push(`/statement?card_id=${card.id}`)}
                className="btn btn-secondary btn-full"
              >
                <Upload size={16} />
                {t('cards.uploadStatement') || 'رفع كشف حساب'}
              </button>
              <button
                onClick={handleDelete}
                className="btn btn-danger btn-full"
              >
                <Trash2 size={16} />
                <span>{t('common.delete')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title={t('cards.deleteCard') || 'Delete Card'}
        message={t('cards.deleteConfirm') || 'Are you sure you want to delete this card? This action cannot be undone.'}
        confirmLabel={t('common.delete') || 'Delete'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </Layout>
  );
}
