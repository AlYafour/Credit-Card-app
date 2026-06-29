'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { cardsAPI, Card } from '@/app/api/cards';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { formatAmount, formatPercent } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import toast from 'react-hot-toast';
import {
  Plus,
  CreditCard as CreditCardIcon,
  Copy,
  Check,
  Building2,
  ChevronDown,
  ChevronUp,
  Search,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  CalendarClock,
  Wallet,
} from 'lucide-react';
import { getCardUrl } from '@/lib/utils';
import BulkActions from '@/components/BulkActions';
import LoadingState from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface BankGroup {
  bankName: string;
  cards: Card[];
  totalLimit: number;
  totalUsed: number;
  totalAvailable: number;
  currency: string;
}

export default function CardsPage() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t } = useTranslations();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankFilter, setBankFilter] = useState('');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, cardId: string | null}>({isOpen: false, cardId: null});
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [collapsedBanks, setCollapsedBanks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

  const loadCards = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await cardsAPI.list();
      setCards(res.items || []);
    } catch (err: any) {
      console.error('Cards API Error:', err);
      setError(err?.response?.data?.message || t('errors.generic'));
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCards();
    }
  }, [isAuthenticated, loadCards]);

  // Group cards by bank name
  const bankGroups = useMemo((): BankGroup[] => {
    const filtered = bankFilter
      ? cards.filter(c => c.bank_name.toLowerCase().includes(bankFilter.toLowerCase()))
      : cards;

    const groupMap = new Map<string, Card[]>();
    filtered.forEach(card => {
      const bank = card.bank_name || 'Other';
      if (!groupMap.has(bank)) groupMap.set(bank, []);
      groupMap.get(bank)!.push(card);
    });

    return Array.from(groupMap.entries())
      .map(([bankName, bankCards]) => {
        let totalLimit = 0;
        let totalUsed = 0;
        bankCards.forEach(c => {
          if (c.card_type === 'credit') {
            totalLimit += Number(c.credit_limit) || 0;
            totalUsed += Number(c.current_balance) || 0;
          }
        });
        return {
          bankName,
          cards: bankCards,
          totalLimit,
          totalUsed,
          totalAvailable: Math.max(totalLimit - totalUsed, 0),
          currency: bankCards[0]?.balance_currency || 'AED',
        };
      })
      .sort((a, b) => b.cards.length - a.cards.length);
  }, [cards, bankFilter]);

  const totalStats = useMemo(() => {
    let totalCards = 0;
    let totalLimit = 0;
    let totalUsed = 0;
    bankGroups.forEach(g => {
      totalCards += g.cards.length;
      totalLimit += g.totalLimit;
      totalUsed += g.totalUsed;
    });
    return { totalCards, totalLimit, totalUsed, totalAvailable: Math.max(totalLimit - totalUsed, 0) };
  }, [bankGroups]);

  const toggleBank = (bankName: string) => {
    setCollapsedBanks(prev => {
      const next = new Set(prev);
      if (next.has(bankName)) next.delete(bankName);
      else next.add(bankName);
      return next;
    });
  };

  const copyCardNumber = async (card: Card) => {
    let cardNumber = '';
    if (revealedCards.has(card.id) && card.card_number) {
      cardNumber = card.card_number.replace(/\s/g, '');
    } else {
      try {
        const cardData = await cardsAPI.get(card.id, true);
        cardNumber = cardData.card_number?.replace(/\s/g, '') || '';
        setCards(prev => prev.map(c => c.id === card.id ? {
          ...c,
          card_number: cardData.card_number,
          cardholder_name: cardData.cardholder_name,
          expiry_month: cardData.expiry_month,
          expiry_year: cardData.expiry_year,
          cvv: cardData.cvv
        } : c));
        setRevealedCards(prev => new Set(prev).add(card.id));
      } catch {
        toast.error(t('errors.generic'));
        return;
      }
    }
    if (cardNumber && !isPlaceholderNumber(cardNumber)) {
      await navigator.clipboard.writeText(cardNumber);
      setCopiedCardId(card.id);
      toast.success(t('common.copied') || 'Card number copied!');
      setTimeout(() => setCopiedCardId(null), 2000);
    } else if (isPlaceholderNumber(cardNumber)) {
      toast.error(t('cards.noFullNumber') || 'Full card number not stored');
    }
  };

  const toggleReveal = async (cardId: string) => {
    if (revealedCards.has(cardId)) {
      setRevealedCards(prev => { const n = new Set(prev); n.delete(cardId); return n; });
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, card_number: undefined, cardholder_name: undefined, expiry_month: undefined, expiry_year: undefined, cvv: undefined } : c));
    } else {
      try {
        const cardData = await cardsAPI.get(cardId, true);
        setCards(prev => prev.map(c => c.id === cardId ? { ...c, card_number: cardData.card_number, cardholder_name: cardData.cardholder_name, expiry_month: cardData.expiry_month, expiry_year: cardData.expiry_year, cvv: cardData.cvv } : c));
        setRevealedCards(prev => new Set(prev).add(cardId));
      } catch {
        toast.error(t('errors.generic'));
      }
    }
  };

  const handleDelete = (id: string) => setDeleteConfirm({ isOpen: true, cardId: id });

  const confirmDelete = async () => {
    const id = deleteConfirm.cardId;
    if (!id) return;
    setDeleteConfirm({ isOpen: false, cardId: null });
    try {
      await cardsAPI.delete(id);
      setCards(cards.filter(c => c.id !== id));
      setSelectedCards(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast.success(t('success.cardDeleted'));
    } catch { toast.error(t('errors.generic')); }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => setSelectedCards(new Set(cards.map(c => c.id)));
  const handleDeselectAll = () => setSelectedCards(new Set());
  const handleDeleteSelected = () => { if (selectedCards.size > 0) setBulkDeleteConfirm(true); };

  const confirmBulkDelete = async () => {
    setBulkDeleteConfirm(false);
    setDeleting(true);
    try {
      await Promise.all(Array.from(selectedCards).map(id => cardsAPI.delete(id)));
      setCards(cards.filter(c => !selectedCards.has(c.id)));
      setSelectedCards(new Set());
      toast.success(t('success.cardsDeleted', { count: selectedCards.size }) || `${selectedCards.size} card(s) deleted`);
    } catch { toast.error(t('errors.generic')); }
    finally { setDeleting(false); }
  };

  const formatCardNumber = (cardNumber: string) => {
    const digits = cardNumber.replace(/\s/g, '');
    if (digits.length === 16) return `${digits.slice(0, 4)}  ${digits.slice(4, 8)}  ${digits.slice(8, 12)}  ${digits.slice(12, 16)}`;
    return cardNumber;
  };

  const isPlaceholderNumber = (number: string) => {
    const digits = number.replace(/\s/g, '');
    return /^0+$/.test(digits) || /^0{12}\d{4}$/.test(digits);
  };

  const getCardNetwork = (card: Card) => {
    if (!card.card_network) return null;
    const n = card.card_network.toLowerCase();
    if (n.includes('visa')) return 'visa';
    if (n.includes('master')) return 'mastercard';
    if (n.includes('amex')) return 'amex';
    return null;
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="cards-page">
        {/* Page Header */}
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon">
              <CreditCardIcon size={32} />
            </div>
            <div className="page-header-text">
              <h1>{t('cards.title') || 'My Cards'}</h1>
              <p className="page-subtitle">{t('cards.subtitle') || 'Manage all your credit and debit cards'}</p>
            </div>
          </div>
        </div>

        {/* Stats Summary Bar */}
        {!loading && cards.length > 0 && (
          <div className="cards-stats-bar">
            <div className="cards-stat-item">
              <span className="cards-stat-value">{totalStats.totalCards}</span>
              <span className="cards-stat-label">{t('cards.totalCards') || 'Cards'}</span>
            </div>
            <div className="cards-stat-divider" />
            <div className="cards-stat-item">
              <span className="cards-stat-value">{bankGroups.length}</span>
              <span className="cards-stat-label">{t('cards.banks') || 'Banks'}</span>
            </div>
            {totalStats.totalLimit > 0 && (
              <>
                <div className="cards-stat-divider" />
                <div className="cards-stat-item">
                  <span className="cards-stat-value cards-stat-available">
                    {formatAmount(totalStats.totalAvailable)} <CurrencySymbol code="AED" size={14} />
                  </span>
                  <span className="cards-stat-label">{t('cards.totalAvailable') || 'Total Available'}</span>
                </div>
                <div className="cards-stat-divider" />
                <div className="cards-stat-item">
                  <span className="cards-stat-value cards-stat-used">
                    {formatAmount(totalStats.totalUsed)} <CurrencySymbol code="AED" size={14} />
                  </span>
                  <span className="cards-stat-label">{t('cards.totalUsed') || 'Total Used'}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Search and Actions */}
        <div className="cards-actions-bar">
          <div className="search-container">
            <Search size={16} className="search-icon-inner" />
            <input
              type="text"
              placeholder={t('cards.filterByBank') || 'Filter by bank name...'}
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="search-input-field"
            />
          </div>
          <Link href="/cards/new" className="btn btn-primary btn-add-card">
            <Plus size={18} />
            <span>{t('cards.addCard') || 'Add Card'}</span>
          </Link>
        </div>

        {/* Bulk Actions */}
        {selectedCards.size > 0 && (
          <BulkActions
            selectedItems={selectedCards}
            totalItems={cards.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onDeleteSelected={handleDeleteSelected}
            itemName="card"
            isLoading={deleting}
          />
        )}

        {/* Content */}
        {loading ? (
          <div className="card"><LoadingState /></div>
        ) : error ? (
          <div className="card"><ErrorState message={error} onRetry={loadCards} /></div>
        ) : cards.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={CreditCardIcon}
              title={t('cards.noCards') || 'No Cards Found'}
              description={t('cards.noCardsDescription') || 'Start by adding your first card to manage your finances'}
              action={{ label: t('cards.addCardLink') || 'Add Your First Card', onClick: () => router.push('/cards/new') }}
            />
          </div>
        ) : bankGroups.length === 0 ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <Search size={48} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
            <p className="text-secondary">{t('cards.noMatchingCards') || 'No cards match your search'}</p>
          </div>
        ) : (
          <div className="bank-groups-container">
            {bankGroups.map((group) => {
              const isCollapsed = collapsedBanks.has(group.bankName);
              return (
                <div key={group.bankName} className="bank-group">
                  {/* Bank Group Header */}
                  <button
                    type="button"
                    className="bank-group-header"
                    onClick={() => toggleBank(group.bankName)}
                  >
                    <div className="bank-group-left">
                      <div className="bank-group-icon">
                        <Building2 size={20} />
                      </div>
                      <div className="bank-group-info">
                        <h3 className="bank-group-name">{group.bankName}</h3>
                        <span className="bank-group-count">
                          {group.cards.length} {group.cards.length === 1 ? (t('cards.card') || 'card') : (t('cards.cardsCount') || 'cards')}
                        </span>
                      </div>
                    </div>
                    <div className="bank-group-right">
                      {group.totalLimit > 0 && (
                        <div className="bank-group-summary">
                          <span className="bank-group-available">
                            {t('cards.available') || 'Available'}: {formatAmount(group.totalAvailable)} <CurrencySymbol code={group.currency} size={12} />
                          </span>
                          <span className="bank-group-limit">
                            / {formatAmount(group.totalLimit)} <CurrencySymbol code={group.currency} size={12} />
                          </span>
                        </div>
                      )}
                      <div className="bank-group-chevron">
                        {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                      </div>
                    </div>
                  </button>

                  {/* Bank Group Cards */}
                  {!isCollapsed && (
                    <div className="bank-group-cards">
                      {group.cards.map((card) => {
                        const usedPct = card.credit_limit && card.current_balance
                          ? (Number(card.current_balance) / Number(card.credit_limit)) * 100
                          : 0;
                        const availableAmount = card.credit_limit
                          ? Math.max(Number(card.credit_limit) - Number(card.current_balance || 0), 0)
                          : null;
                        const network = getCardNetwork(card);
                        const isSelected = selectedCards.has(card.id);
                        const isRevealed = revealedCards.has(card.id);

                        return (
                          <div key={card.id} className={`bank-card-row ${isSelected ? 'bank-card-selected' : ''}`}>
                            {/* Selection checkbox */}
                            <label className="bank-card-checkbox">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(card.id)}
                              />
                            </label>

                            {/* Card main content */}
                            <Link href={getCardUrl(card.id, card.card_name)} className="bank-card-main">
                              {/* Card identity */}
                              <div className="bank-card-identity">
                                <div className="bank-card-visual">
                                  {network === 'visa' && <div className="card-network-badge visa">VISA</div>}
                                  {network === 'mastercard' && <div className="card-network-badge mc">MC</div>}
                                  {network === 'amex' && <div className="card-network-badge amex">AMEX</div>}
                                  {!network && <div className="card-network-badge generic"><CreditCardIcon size={16} /></div>}
                                </div>
                                <div className="bank-card-details">
                                  <div className="bank-card-name">{card.card_name}</div>
                                  <div className="bank-card-number-row">
                                    <span className="bank-card-digits">
                                      {isRevealed && card.card_number && !isPlaceholderNumber(card.card_number)
                                        ? formatCardNumber(card.card_number)
                                        : `•••• •••• •••• ${card.card_last_four}`}
                                    </span>
                                    <span className={`bank-card-type-badge ${card.card_type}`}>
                                      {t(`cards.${card.card_type}`) || card.card_type}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Credit info */}
                              {card.card_type === 'credit' && card.credit_limit ? (
                                <div className="bank-card-credit">
                                  <div className="bank-card-credit-bar">
                                    <div className="bank-card-credit-track">
                                      <div
                                        className={`bank-card-credit-fill ${usedPct > 80 ? 'danger' : usedPct > 50 ? 'warning' : ''}`}
                                        style={{ width: `${Math.min(usedPct, 100)}%` }}
                                      />
                                    </div>
                                    <span className="bank-card-credit-pct">{Math.round(usedPct)}%</span>
                                    {usedPct > 80 && (
                                      <span className="card-utilization-warning" title="High credit utilization — consider paying down this card">
                                        ⚠ High
                                      </span>
                                    )}
                                  </div>
                                  <div className="bank-card-credit-nums">
                                    <span className="bank-card-available-num">
                                      <Wallet size={12} />
                                      {t('cards.available') || 'Available'}: <strong>{formatAmount(availableAmount || 0)}</strong>
                                    </span>
                                    <span className="bank-card-limit-num">
                                      {t('cards.creditLimit') || 'Limit'}: {formatAmount(card.credit_limit)}
                                    </span>
                                  </div>
                                </div>
                              ) : card.card_type !== 'credit' && card.available_balance != null ? (
                                <div className="bank-card-credit">
                                  <div className="bank-card-credit-nums">
                                    <span className="bank-card-available-num">
                                      <Wallet size={12} />
                                      {t('cards.availableBalance') || 'Balance'}: <strong>{formatAmount(card.available_balance)}</strong>
                                      {' '}<CurrencySymbol code={card.balance_currency} size={12} />
                                    </span>
                                  </div>
                                </div>
                              ) : null}

                              {/* Due date */}
                              {card.card_type === 'credit' && card.payment_due_date && (
                                <div className="bank-card-due">
                                  <CalendarClock size={13} />
                                  <span>{t('cards.day') || 'Day'} {card.payment_due_date}</span>
                                </div>
                              )}
                            </Link>

                            {/* Card actions */}
                            <div className="bank-card-actions">
                              <button
                                type="button"
                                className="bank-card-action-btn"
                                onClick={() => toggleReveal(card.id)}
                                title={isRevealed ? (t('cards.hide') || 'Hide') : (t('cards.reveal') || 'Reveal')}
                              >
                                {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                              <button
                                type="button"
                                className="bank-card-action-btn"
                                onClick={() => copyCardNumber(card)}
                                title={t('common.copy') || 'Copy'}
                              >
                                {copiedCardId === card.id ? <Check size={16} /> : <Copy size={16} />}
                              </button>
                              <button
                                type="button"
                                className="bank-card-action-btn danger"
                                onClick={() => handleDelete(card.id)}
                                title={t('common.delete') || 'Delete'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={t('cards.deleteCard') || 'Delete Card'}
        message={t('cards.deleteConfirm') || 'Are you sure you want to delete this card? This action cannot be undone.'}
        confirmLabel={t('common.delete') || 'Delete'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, cardId: null })}
      />

      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        title={t('cards.deleteCards') || 'Delete Cards'}
        message={t('cards.deleteMultipleConfirm', { count: selectedCards.size }) || `Are you sure you want to delete ${selectedCards.size} card(s)?`}
        confirmLabel={t('common.delete') || 'Delete'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        variant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </Layout>
  );
}
