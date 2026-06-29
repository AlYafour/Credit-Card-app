'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';
import Layout from '@/components/Layout';
import toast from 'react-hot-toast';
import {
  ShoppingBasket, Plus, Trash2, Edit2, Tag, Building2, User,
  HelpCircle, X, Check, RefreshCw, ExternalLink, FileDown,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { merchantGroupsAPI, MerchantGroup } from '../api/merchant-groups';
import { transactionsAPI } from '../api/transactions';

const COLORS = ['#6b2c91','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
const MATCH_TYPES = ['contains', 'exact', 'starts_with'] as const;

type TFn = (key: string, params?: Record<string, string | number>) => string;

// ── Budget progress bar ───────────────────────────────────────────────────────
function BudgetBar({ spent, budget }: { spent: number; budget?: number | null }) {
  if (!budget) return null;
  const pct = Math.min(100, (spent / budget) * 100);
  const danger = pct >= 90;
  const warn = pct >= 70;
  return (
    <div className="basket-budget-wrap">
      <div className="basket-budget-labels">
        <span>{spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} AED</span>
        <span className={danger ? 'text-danger' : warn ? 'text-warning' : ''}>
          {Math.round(pct)}% of {budget.toLocaleString(undefined, { maximumFractionDigits: 0 })} AED
        </span>
      </div>
      <div className="basket-budget-track">
        <div
          className="basket-budget-fill"
          style={{
            width: `${pct}%`,
            background: danger ? 'var(--error)' : warn ? '#f59e0b' : 'var(--success)',
          }}
        />
      </div>
    </div>
  );
}

// ── Create / Edit form ────────────────────────────────────────────────────────
function BasketForm({
  initial, onSave, onCancel, t,
}: {
  initial?: Partial<MerchantGroup>;
  onSave: (data: Partial<MerchantGroup>) => Promise<void>;
  onCancel: () => void;
  t: TFn;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [budget, setBudget] = useState(initial?.monthly_budget?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), group_type: 'mixed', color, monthly_budget: budget ? parseFloat(budget) : null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="basket-form">
      <div className="form-group">
        <label className="form-label">{t('basketName')}</label>
        <input
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('basketNamePlaceholder')}
          autoFocus
        />
      </div>

      <div className="form-group">
        <label className="form-label">{t('color')}</label>
        <div className="basket-color-row">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`basket-color-dot ${color === c ? 'active' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">{t('monthlyBudget')}</label>
        <input
          type="number"
          className="form-input no-rtl"
          value={budget}
          onChange={e => setBudget(e.target.value)}
          placeholder="0.00 AED"
          min="0"
        />
      </div>

      <div className="basket-form-actions">
        <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary">
          {saving ? '...' : <><Check size={15} /> {initial ? t('save') : t('newBasket')}</>}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          <X size={15} /> {t('cancel') || 'Cancel'}
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BasketsPage() {
  const { t } = useTranslations('baskets');
  const router = useRouter();
  const [groups, setGroups] = useState<MerchantGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingRuleTo, setAddingRuleTo] = useState<string | null>(null);
  const [newMerchant, setNewMerchant] = useState({ name: '', matchType: 'contains' as typeof MATCH_TYPES[number] });
  const [classifying, setClassifying] = useState(false);

  const load = useCallback(async () => {
    try {
      const gs = await merchantGroupsAPI.list();
      setGroups(gs);
    } catch {
      toast.error('Failed to load baskets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data: Partial<MerchantGroup>) {
    await merchantGroupsAPI.create(data);
    setShowCreate(false);
    toast.success('Basket created');
    load();
  }

  async function handleUpdate(id: string, data: Partial<MerchantGroup>) {
    await merchantGroupsAPI.update(id, data);
    setEditingId(null);
    toast.success('Basket updated');
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm(t('deleteConfirm'))) return;
    await merchantGroupsAPI.delete(id);
    toast.success('Basket deleted');
    load();
  }

  async function handleAddRule(groupId: string) {
    if (!newMerchant.name.trim()) return;
    try {
      await merchantGroupsAPI.addRule(groupId, { merchant_name: newMerchant.name.trim(), match_type: newMerchant.matchType });
      setNewMerchant({ name: '', matchType: 'contains' });
      setAddingRuleTo(null);
      toast.success('Merchant added');
      load();
    } catch {
      toast.error('Merchant already exists in this basket');
    }
  }

  async function handleRemoveRule(groupId: string, ruleId: string) {
    await merchantGroupsAPI.removeRule(groupId, ruleId);
    load();
  }

  async function handleClassify() {
    setClassifying(true);
    try {
      const { classified } = await merchantGroupsAPI.classifyAll();
      toast.success(`${classified} ${t('classified')}`);
      load();
    } finally {
      setClassifying(false);
    }
  }

  function handleViewTransactions(groupId: string) {
    router.push(`/transactions?basket_id=${groupId}`);
  }

  function handleExportBasket(groupId: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const url = transactionsAPI.exportExcel({ merchant_group_id: groupId });
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('Export failed');
        return r.blob();
      })
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'basket-transactions.xlsx';
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Export failed'));
  }

  const totalMonthly = groups.reduce((s, g) => s + (g.monthly_spent || 0), 0);
  const totalTxns = groups.reduce((s, g) => s + (g.transaction_count || 0), 0);
  const summaryItems = [
    { label: t('totalBaskets') || 'عدد السلال', value: groups.length, icon: <ShoppingBasket size={20} />, color: 'var(--primary)', isCount: true },
    { label: t('totalMonthlySpent') || 'الإنفاق الشهري', value: totalMonthly, icon: <Tag size={20} />, color: '#10b981', isCount: false },
    { label: t('totalTransactions') || 'إجمالي المعاملات', value: totalTxns, icon: <RefreshCw size={20} />, color: '#3b82f6', isCount: true },
  ];

  return (
    <Layout>
      <div>
        {/* ── Header ── */}
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon">
              <ShoppingBasket size={28} />
            </div>
            <div className="page-header-text">
              <h1>{t('title')}</h1>
              <p className="page-subtitle">{t('subtitle')}</p>
            </div>
            <div className="page-header-actions">
              <button
                onClick={handleClassify}
                disabled={classifying}
                className="btn btn-ghost"
              >
                <RefreshCw size={15} className={classifying ? 'animate-spin' : ''} />
                {t('classifyAll')}
              </button>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="btn btn-primary"
              >
                <Plus size={16} />
                {t('newBasket')}
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary strip ── */}
        {!loading && (
          <div className="basket-summary-row mb-6">
            {summaryItems.map(item => (
              <div key={item.label} className="card basket-summary-card">
                <div className="basket-summary-icon" style={{ color: item.color, background: `${item.color}18` }}>
                  {item.icon}
                </div>
                <div>
                  <div className="basket-summary-label">{item.label}</div>
                  <div className="basket-summary-value">
                    {item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    {!item.isCount && <span className="basket-summary-currency"> AED</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Create modal ── */}
        {showCreate && (
          <div className="basket-modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="basket-modal" onClick={e => e.stopPropagation()}>
              <div className="basket-modal-header">
                <h3 className="basket-modal-title">
                  <ShoppingBasket size={18} style={{ color: 'var(--primary)' }} />
                  {t('newBasket')}
                </h3>
                <button onClick={() => setShowCreate(false)} className="btn-icon"><X size={18} /></button>
              </div>
              <BasketForm t={t} onSave={handleCreate} onCancel={() => setShowCreate(false)} />
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading ? (
          <div className="card flex items-center justify-center" style={{ minHeight: 200 }}>
            <div className="spinner" />
          </div>
        ) : groups.length === 0 && !showCreate ? (
          <div className="card text-center" style={{ padding: '60px 20px' }}>
            <Tag size={40} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
            <p style={{ fontWeight: 600, color: 'var(--text)' }}>{t('noBaskets')}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>{t('noBasketsDesc')}</p>
          </div>
        ) : (
          /* ── Baskets grid ── */
          <div className="basket-grid">
            {groups.map(group => (
              <div key={group.id} className="card basket-card" style={{ borderTop: `3px solid ${group.color}` }}>
                {editingId === group.id ? (
                  <div className="basket-modal-overlay" onClick={() => setEditingId(null)}>
                    <div className="basket-modal" onClick={e => e.stopPropagation()}>
                      <div className="basket-modal-header">
                        <h3 className="basket-modal-title">
                          <Edit2 size={18} style={{ color: 'var(--primary)' }} />
                          {t('editBasket')}
                        </h3>
                        <button onClick={() => setEditingId(null)} className="btn-icon"><X size={18} /></button>
                      </div>
                      <BasketForm
                        t={t}
                        initial={group}
                        onSave={data => handleUpdate(group.id, data)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Card header */}
                    <div className="basket-card-header">
                      <div className="basket-card-title">
                        <span className="basket-color-dot-sm" style={{ background: group.color }} />
                        <span className="basket-name">{group.name}</span>
                      </div>
                      <div className="basket-card-actions">
                        <button
                          onClick={() => setEditingId(group.id)}
                          className="btn-icon"
                          title={t('editBasket')}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(group.id)}
                          className="btn-icon btn-icon-danger"
                          title={t('deleteBasket')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="basket-stats">
                      <div className="basket-stat">
                        <span className="basket-stat-label">{t('monthlySpent')}</span>
                        <span className="basket-stat-value">
                          {group.monthly_spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} AED
                        </span>
                      </div>
                      <div className="basket-stat">
                        <span className="basket-stat-label">{t('transactions')}</span>
                        <span className="basket-stat-value">{group.transaction_count}</span>
                      </div>
                      {group.total_spent > 0 && (
                        <div className="basket-stat">
                          <span className="basket-stat-label">{t('totalSpent')}</span>
                          <span className="basket-stat-value">
                            {group.total_spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} AED
                          </span>
                        </div>
                      )}
                    </div>

                    <BudgetBar spent={group.monthly_spent} budget={group.monthly_budget} />

                    {/* Quick action buttons */}
                    <div className="basket-quick-actions">
                      <button
                        onClick={() => handleViewTransactions(group.id)}
                        className="btn btn-ghost basket-action-btn"
                      >
                        <ExternalLink size={14} />
                        {t('viewTransactions')}
                      </button>
                      <button
                        onClick={() => handleExportBasket(group.id)}
                        className="btn btn-ghost basket-action-btn"
                      >
                        <FileDown size={14} />
                        {t('exportBasket')}
                      </button>
                    </div>

                    {/* Merchant rules */}
                    <div className="basket-rules-section">
                      <div className="basket-rules-header">
                        <span className="basket-rules-title">{t('rules')}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              setAddingRuleTo(addingRuleTo === group.id ? null : group.id);
                              setExpandedId(group.id);
                            }}
                            className="basket-rules-add-btn"
                          >
                            <Plus size={12} /> {t('addRule')}
                          </button>
                          <button
                            onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}
                            className="btn-icon"
                            style={{ width: 24, height: 24 }}
                          >
                            {expandedId === group.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {addingRuleTo === group.id && (
                        <div className="basket-rule-add-row">
                          <input
                            value={newMerchant.name}
                            onChange={e => setNewMerchant(p => ({ ...p, name: e.target.value }))}
                            placeholder={t('merchantName')}
                            className="form-input"
                            style={{ flex: 1 }}
                            onKeyDown={e => e.key === 'Enter' && handleAddRule(group.id)}
                            autoFocus
                          />
                          <select
                            value={newMerchant.matchType}
                            onChange={e => setNewMerchant(p => ({ ...p, matchType: e.target.value as typeof MATCH_TYPES[number] }))}
                            className="form-input"
                            style={{ width: 120 }}
                          >
                            {MATCH_TYPES.map(m => (
                              <option key={m} value={m}>{t(`match_${m}`)}</option>
                            ))}
                          </select>
                          <button onClick={() => handleAddRule(group.id)} className="btn btn-primary" style={{ padding: '0 14px' }}>
                            <Check size={14} />
                          </button>
                        </div>
                      )}

                      {(expandedId === group.id || group.rules.length <= 4) && (
                        group.rules.length === 0 ? (
                          <p className="basket-no-rules">{t('noRules')}</p>
                        ) : (
                          <div className="basket-tags">
                            {group.rules.map(rule => (
                              <span key={rule.id} className="basket-tag">
                                {rule.merchant_name}
                                <span className="basket-tag-match">·{rule.match_type.slice(0, 3)}</span>
                                <button
                                  onClick={() => handleRemoveRule(group.id, rule.id)}
                                  className="basket-tag-remove"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
