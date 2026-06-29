'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Edit2, Tag, TrendingUp, Building2, User, HelpCircle, X, Check, RefreshCw, ExternalLink, FileDown } from 'lucide-react';
import { transactionsAPI } from '../api/transactions';
import toast from 'react-hot-toast';
import { merchantGroupsAPI, MerchantGroup, MerchantRule } from '../api/merchant-groups';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
const GROUP_TYPES = ['company','personal','mixed'] as const;
const MATCH_TYPES = ['contains','exact','starts_with'] as const;

function typeIcon(type: string) {
  if (type === 'company') return <Building2 size={14} />;
  if (type === 'personal') return <User size={14} />;
  return <HelpCircle size={14} />;
}

function BudgetBar({ spent, budget }: { spent: number; budget?: number | null }) {
  if (!budget) return null;
  const pct = Math.min(100, (spent / budget) * 100);
  const danger = pct >= 90;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{spent.toLocaleString(undefined,{maximumFractionDigits:0})} AED</span>
        <span>{budget.toLocaleString(undefined,{maximumFractionDigits:0})} AED</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: danger ? '#ef4444' : '#10b981' }}
        />
      </div>
    </div>
  );
}

interface GroupFormProps {
  initial?: Partial<MerchantGroup>;
  onSave: (data: Partial<MerchantGroup>) => Promise<void>;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}

function GroupForm({ initial, onSave, onCancel, t }: GroupFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [groupType, setGroupType] = useState<'company'|'personal'|'mixed'>(initial?.group_type ?? 'mixed');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [budget, setBudget] = useState(initial?.monthly_budget?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        group_type: groupType,
        color,
        monthly_budget: budget ? parseFloat(budget) : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">{t('basketName')}</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('basketNamePlaceholder')}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">{t('basketType')}</label>
        <div className="flex gap-2">
          {GROUP_TYPES.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setGroupType(type)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm border transition-all ${
                groupType === type
                  ? 'border-indigo-500 bg-indigo-500/20 text-white'
                  : 'border-white/20 text-gray-400 hover:border-white/40'
              }`}
            >
              {typeIcon(type)}
              {t(`type_${type}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-2">{t('color')}</label>
        <div className="flex gap-2">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full border-2 transition-all"
              style={{ backgroundColor: c, borderColor: color === c ? '#fff' : 'transparent' }}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">{t('monthlyBudget')}</label>
        <input
          type="number"
          value={budget}
          onChange={e => setBudget(e.target.value)}
          placeholder="0.00 AED"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? '...' : <Check size={16} className="mx-auto" />}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm transition-colors">
          <X size={16} className="mx-auto" />
        </button>
      </div>
    </form>
  );
}

export default function BasketsPage() {
  const t = useTranslations('baskets');
  const router = useRouter();
  const [groups, setGroups] = useState<MerchantGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newMerchant, setNewMerchant] = useState<{ name: string; matchType: typeof MATCH_TYPES[number] }>({ name: '', matchType: 'contains' });
  const [addingRuleTo, setAddingRuleTo] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [summary, setSummary] = useState<{ company: number; personal: number; unclassified: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [gs, sum] = await Promise.all([merchantGroupsAPI.list(), merchantGroupsAPI.summary()]);
      setGroups(gs);
      setSummary(sum);
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

  function handleViewTransactions(groupId: string) {
    router.push(`/transactions?basket_id=${groupId}`);
  }

  function handleExportBasket(groupId: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const url = transactionsAPI.exportExcel({ merchant_group_id: groupId });
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `basket-transactions.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Export failed'));
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          <p className="text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClassify}
            disabled={classifying}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <RefreshCw size={15} className={classifying ? 'animate-spin' : ''} />
            {t('classifyAll')}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {t('newBasket')}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t('companySummary'), value: summary.company, color: '#6366f1', icon: <Building2 size={18} /> },
            { label: t('personalSummary'), value: summary.personal, color: '#10b981', icon: <User size={18} /> },
            { label: t('unclassified'), value: summary.unclassified, color: '#6b7280', icon: <HelpCircle size={18} /> },
          ].map(item => (
            <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                {item.icon}
              </div>
              <div>
                <div className="text-xs text-gray-400">{item.label}</div>
                <div className="text-lg font-semibold text-white">
                  {item.value.toLocaleString(undefined,{maximumFractionDigits:0})} <span className="text-xs text-gray-400">AED</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white/5 border border-white/20 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">{t('newBasket')}</h3>
          <GroupForm t={t} onSave={handleCreate} onCancel={() => setShowCreate(false)} />
        </div>
      )}

      {/* Groups grid */}
      {groups.length === 0 && !showCreate ? (
        <div className="text-center py-16 text-gray-400">
          <Tag size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t('noBaskets')}</p>
          <p className="text-sm mt-1">{t('noBasketsDesc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(group => (
            <div key={group.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              {editingId === group.id ? (
                <div className="p-5">
                  <GroupForm
                    t={t}
                    initial={group}
                    onSave={(data) => handleUpdate(group.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <>
                  {/* Card header */}
                  <div className="p-5" style={{ borderTop: `3px solid ${group.color}` }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                        <span className="font-semibold text-white">{group.name}</span>
                        <span
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${group.color}20`, color: group.color }}
                        >
                          {typeIcon(group.group_type)}
                          {t(`type_${group.group_type}`)}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingId(group.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(group.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-400 text-xs">{t('monthlySpent')}</div>
                        <div className="text-white font-medium">{group.monthly_spent.toLocaleString(undefined,{maximumFractionDigits:0})} AED</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">{t('transactions')}</div>
                        <div className="text-white font-medium">{group.transaction_count}</div>
                      </div>
                    </div>

                    <BudgetBar spent={group.monthly_spent} budget={group.monthly_budget} />

                    {/* Quick actions */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleViewTransactions(group.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                      >
                        <ExternalLink size={12} />
                        {t('viewTransactions')}
                      </button>
                      <button
                        onClick={() => handleExportBasket(group.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                      >
                        <FileDown size={12} />
                        {t('exportBasket')}
                      </button>
                    </div>
                  </div>

                  {/* Rules section */}
                  <div className="border-t border-white/10 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{t('rules')}</span>
                      <button
                        onClick={() => { setAddingRuleTo(addingRuleTo === group.id ? null : group.id); setExpandedId(group.id); }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <Plus size={12} /> {t('addRule')}
                      </button>
                    </div>

                    {addingRuleTo === group.id && (
                      <div className="flex gap-2 mb-3">
                        <input
                          value={newMerchant.name}
                          onChange={e => setNewMerchant(p => ({ ...p, name: e.target.value }))}
                          placeholder={t('merchantName')}
                          className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                          onKeyDown={e => e.key === 'Enter' && handleAddRule(group.id)}
                          autoFocus
                        />
                        <select
                          value={newMerchant.matchType}
                          onChange={e => setNewMerchant(p => ({ ...p, matchType: e.target.value as typeof MATCH_TYPES[number] }))}
                          className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                        >
                          {MATCH_TYPES.map(m => <option key={m} value={m}>{t(`match_${m}`)}</option>)}
                        </select>
                        <button onClick={() => handleAddRule(group.id)} className="bg-indigo-600 text-white px-3 rounded-lg text-sm">
                          <Check size={14} />
                        </button>
                      </div>
                    )}

                    {group.rules.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">{t('noRules')}</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {group.rules.map(rule => (
                          <div
                            key={rule.id}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300"
                          >
                            <span>{rule.merchant_name}</span>
                            <span className="text-gray-500">·{rule.match_type.slice(0,3)}</span>
                            <button onClick={() => handleRemoveRule(group.id, rule.id)} className="ml-1 text-gray-500 hover:text-red-400">
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
