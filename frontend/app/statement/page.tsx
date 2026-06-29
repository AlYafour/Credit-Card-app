'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { cardsAPI, type Card } from '@/app/api/cards';
import { useTranslations } from '@/lib/i18n';
import { formatAmount } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import toast from 'react-hot-toast';
import {
  Upload, FileText, CheckCircle, Loader2, CreditCard, Receipt,
  X, ChevronDown, ChevronUp, Building2, Banknote,
  TrendingDown, TrendingUp, RefreshCw, Lock, Eye, EyeOff,
  Trash2, KeyRound, AlertCircle, Clock, PlayCircle, Files,
} from 'lucide-react';

type CardInfo = {
  bank_name?: string; card_name?: string; card_last_four?: string;
  cardholder_name?: string; credit_limit?: number; available_balance?: number;
  statement_balance?: number; statement_date?: number; payment_due_date?: number;
  payment_due_full_date?: string; minimum_payment?: number;
  minimum_payment_percentage?: number; annual_fee?: number;
  late_payment_fee?: number; over_limit_fee?: number;
  account_manager_name?: string; account_manager_phone?: string;
  bank_emails?: string[]; currency?: string;
  statement_period_from?: string; statement_period_to?: string;
};
type ParsedTxn = {
  date: string; merchant: string; amount: number; type: string;
  currency: string; category?: string; selected?: boolean;
  _fileIndex?: number; _fileName?: string; _bankName?: string;
};
type FileStatus = 'waiting' | 'processing' | 'done' | 'error' | 'password_required';
type FileEntry = {
  id: string; file: File; base64: string; status: FileStatus;
  error?: string; cardInfo?: CardInfo; transactions?: ParsedTxn[];
  matchedCardId?: string; matchedCardName?: string; selectedCardId?: string;
  passwordRequired?: boolean; password?: string; savePassword?: boolean;
};
type SavedPassword = { id: string; bank_name: string; updated_at: string };

const TXN_LABELS: Record<string, { ar: string; en: string }> = {
  purchase:   { ar: 'شراء',    en: 'Purchase'   },
  payment:    { ar: 'دفعة',    en: 'Payment'    },
  refund:     { ar: 'استرداد', en: 'Refund'     },
  withdrawal: { ar: 'سحب',    en: 'Withdrawal' },
  transfer:   { ar: 'تحويل',  en: 'Transfer'   },
  deposit:    { ar: 'إيداع',  en: 'Deposit'    },
};

const uid = () => Math.random().toString(36).slice(2);

export default function StatementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCardId = searchParams.get('card_id') ?? undefined;
  const { locale } = useTranslations();
  const ar = locale === 'ar';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);

  const [allTransactions, setAllTransactions] = useState<ParsedTxn[]>([]);
  const [showAllTxns, setShowAllTxns] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importSummary, setImportSummary] = useState({ created: 0, skipped: 0, cards: 0 });

  const [savedPasswords, setSavedPasswords] = useState<SavedPassword[]>([]);
  const [showPwManager, setShowPwManager] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBankPassword, setNewBankPassword] = useState('');
  const [showPwInput, setShowPwInput] = useState<Record<string, boolean>>({});

  const [existingCards, setExistingCards] = useState<Card[]>([]);

  filesRef.current = files;

  useEffect(() => {
    cardsAPI.getBankPasswords().then(setSavedPasswords).catch(() => {});
    cardsAPI.list().then(res => setExistingCards(res.items ?? [])).catch(() => {});
  }, []);

  const readBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const addFiles = useCallback(async (newFiles: File[]) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const validExts  = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const isValid = (f: File) =>
      (validTypes.includes(f.type) || validExts.some(e => f.name.toLowerCase().endsWith(e)))
      && f.size <= 25 * 1024 * 1024;
    const filtered = newFiles.filter(isValid).slice(0, 15);
    if (filtered.length < newFiles.length)
      toast(`${newFiles.length - filtered.length} ${ar ? 'ملف غير مدعوم أو تجاوز الحجم' : 'file(s) skipped (unsupported or too large)'}`, { icon: '⚠️' });
    const entries: FileEntry[] = await Promise.all(
      filtered.map(async file => ({
        id: uid(), file, base64: await readBase64(file),
        status: 'waiting' as FileStatus, password: '', savePassword: true,
      }))
    );
    setFiles(prev => [...prev, ...entries].slice(0, 15));
  }, [ar]);

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));
  const reset = () => { setFiles([]); setAllTransactions([]); setImportDone(false); setCurrentIdx(-1); };

  const processAll = async () => {
    const waiting = filesRef.current.filter(f =>
      f.status === 'waiting' || f.status === 'error' ||
      (f.status === 'password_required' && f.password)
    );
    if (!waiting.length) { toast.error(ar ? 'لا توجد ملفات للمعالجة' : 'No files to process'); return; }

    setProcessing(true);
    const collected: ParsedTxn[] = [...allTransactions];

    for (let i = 0; i < filesRef.current.length; i++) {
      const entry = filesRef.current[i];
      if (entry.status === 'done') continue;
      if (entry.status === 'password_required' && !entry.password) continue;
      if (entry.status === 'processing') continue;

      setCurrentIdx(i);
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));
      const latest = filesRef.current[i];

      try {
        const result = await cardsAPI.parseStatement(latest.base64, latest.file.type, {
          pdf_password: latest.password || undefined,
          save_password: latest.savePassword,
        });

        if (result.error === 'pdf_password_required') {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'password_required', passwordRequired: true, error: ar ? 'محمي بكلمة سر' : 'Password protected' } : f));
          continue;
        }
        if (result.error === 'pdf_password_wrong') {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'password_required', passwordRequired: true, error: ar ? 'كلمة السر غير صحيحة' : 'Wrong password' } : f));
          continue;
        }
        if (result.error) {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: result.error } : f));
          continue;
        }

        const bankName = result.card_info?.bank_name || latest.file.name;
        const txns = (result.transactions || []).map((t: ParsedTxn) => ({
          ...t, selected: true, _fileIndex: i, _fileName: latest.file.name, _bankName: bankName,
        }));
        collected.push(...txns);

        if (result.password_saved)
          cardsAPI.getBankPasswords().then(setSavedPasswords).catch(() => {});

        setFiles(prev => prev.map((f, idx) => idx === i ? {
          ...f, status: 'done', cardInfo: result.card_info, transactions: txns,
          matchedCardId: result.matched_card_id, matchedCardName: result.matched_card_name,
          selectedCardId: result.matched_card_id ? undefined : preselectedCardId,
        } : f));

      } catch (err: unknown) {
        const axErr = err as { response?: { data?: { error?: string } } };
        const code = axErr?.response?.data?.error;
        if (code === 'pdf_password_required') {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'password_required', passwordRequired: true, error: ar ? 'محمي بكلمة سر' : 'Password protected' } : f));
        } else if (code === 'pdf_password_wrong') {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'password_required', passwordRequired: true, error: ar ? 'كلمة السر غير صحيحة' : 'Wrong password' } : f));
        } else {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: ar ? 'فشل الاتصال' : 'Connection failed' } : f));
        }
      }
    }

    setAllTransactions(collected);
    setCurrentIdx(-1);
    setProcessing(false);
    toast.success(ar ? `تم تحليل ${collected.length} معاملة` : `Analysed ${collected.length} transactions`);
  };

  const toggleTxn   = (idx: number) => setAllTransactions(prev => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  const toggleAll   = () => { const all = allTransactions.every(t => t.selected); setAllTransactions(prev => prev.map(t => ({ ...t, selected: !all }))); };
  const toggleBank  = (bank: string) => {
    const allSel = allTransactions.filter(t => t._bankName === bank).every(t => t.selected);
    setAllTransactions(prev => prev.map(t => t._bankName === bank ? { ...t, selected: !allSel } : t));
  };

  const handleImport = async () => {
    const selected = allTransactions.filter(t => t.selected);
    if (!selected.length) { toast.error(ar ? 'اختر معاملة واحدة على الأقل' : 'Select at least one transaction'); return; }
    setImporting(true);
    let totalCreated = 0, totalSkipped = 0, newCards = 0;

    const byFile = new Map<number, { cardInfo: CardInfo; txns: ParsedTxn[]; cardId?: string; fileBase64?: string; fileType?: string; fileName?: string }>();
    for (const txn of selected) {
      const fi = txn._fileIndex ?? 0;
      if (!byFile.has(fi)) {
        const fe = files[fi];
        byFile.set(fi, {
          cardInfo: fe?.cardInfo || {},
          txns: [],
          cardId: fe?.selectedCardId || fe?.matchedCardId,
          fileBase64: fe?.base64,
          fileType: fe?.file.type,
          fileName: fe?.file.name,
        });
      }
      byFile.get(fi)!.txns.push(txn);
    }

    for (const { cardInfo, txns, cardId, fileBase64, fileType, fileName } of Array.from(byFile.values())) {
      try {
        const r = await cardsAPI.importStatement({
          card_info: cardInfo as Record<string, unknown>,
          transactions: txns as unknown as Array<Record<string, unknown>>,
          card_id: cardId,
          file: fileBase64,
          file_type: fileType,
          file_name: fileName,
        });
        totalCreated += r.transactions_created;
        totalSkipped += r.transactions_skipped;
        if (r.card_created) newCards++;
      } catch { /* continue */ }
    }

    setImportSummary({ created: totalCreated, skipped: totalSkipped, cards: newCards });
    setImportDone(true);
    setImporting(false);
    toast.success(ar ? `تم حفظ ${totalCreated} معاملة` : `Saved ${totalCreated} transactions`);
  };

  const addPassword = async () => {
    if (!newBankName.trim() || !newBankPassword.trim()) { toast.error(ar ? 'أدخل اسم البنك وكلمة السر' : 'Enter bank name and password'); return; }
    await cardsAPI.saveBankPassword(newBankName.trim(), newBankPassword.trim());
    setSavedPasswords(await cardsAPI.getBankPasswords());
    setNewBankName(''); setNewBankPassword('');
    toast.success(ar ? 'تم الحفظ' : 'Saved');
  };
  const deletePassword = async (bank: string) => {
    await cardsAPI.deleteBankPassword(bank);
    setSavedPasswords(p => p.filter(x => x.bank_name !== bank));
    toast.success(ar ? 'تم الحذف' : 'Deleted');
  };

  const selectedCount = allTransactions.filter(t => t.selected).length;
  const doneFiles    = files.filter(f => f.status === 'done').length;
  const errorFiles   = files.filter(f => f.status === 'error').length;
  const pwFiles      = files.filter(f => f.status === 'password_required').length;
  const uniqueBanks  = Array.from(new Set(allTransactions.map(t => t._bankName).filter(Boolean))) as string[];
  const totalPurchases = allTransactions.filter(t => t.selected && ['purchase', 'withdrawal'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const totalPayments  = allTransactions.filter(t => t.selected && ['payment', 'refund'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const visibleTxns  = showAllTxns ? allTransactions : allTransactions.slice(0, 15);
  const canProcess   = files.some(f => f.status === 'waiting' || f.status === 'error' || (f.status === 'password_required' && f.password));
  const hasResults   = allTransactions.length > 0;

  const statusIcon = (s: FileStatus) => {
    if (s === 'waiting')           return <Clock size={15} color="var(--text-secondary)" />;
    if (s === 'processing')        return <Loader2 size={15} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />;
    if (s === 'done')              return <CheckCircle size={15} color="var(--success)" />;
    if (s === 'error')             return <AlertCircle size={15} color="var(--danger)" />;
    if (s === 'password_required') return <Lock size={15} color="var(--warning, #f59e0b)" />;
  };

  return (
    <Layout>
      <div>

        {/* ── Header ── */}
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon"><Files size={28} /></div>
            <div className="page-header-text">
              <h1>{ar ? 'استيراد كشوفات الحساب' : 'Import Bank Statements'}</h1>
              <p className="page-subtitle">
                {ar ? 'ارفع حتى 15 كشف PDF أو صورة دفعة واحدة' : 'Upload up to 15 PDF or image statements at once'}
              </p>
            </div>
            <div className="page-header-actions">
              <button onClick={() => setShowPwManager(v => !v)} className="btn btn-secondary" title={ar ? 'كلمات سر البنوك' : 'Bank passwords'}>
                <KeyRound size={16} />
                {savedPasswords.length > 0 && (
                  <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                    {savedPasswords.length}
                  </span>
                )}
              </button>
              {(files.length > 0 || hasResults) && (
                <button onClick={reset} className="btn btn-secondary">
                  <RefreshCw size={16} /><span>{ar ? 'بداية جديدة' : 'Start Over'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Password Manager ── */}
        {showPwManager && (
          <div className="card mb-6" style={{ borderColor: 'var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <KeyRound size={17} color="var(--primary)" />
              <h3 style={{ margin: 0 }}>{ar ? 'كلمات سر البنوك' : 'Bank Passwords'}</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', flex: 1 }}>
                {ar ? 'مشفرة — تُستخدم تلقائياً' : 'Encrypted — used automatically'}
              </span>
              <button onClick={() => setShowPwManager(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}><X size={14} /></button>
            </div>
            {savedPasswords.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {ar ? 'لا توجد كلمات سر بعد' : 'No passwords saved yet'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                {savedPasswords.map(bp => (
                  <div key={bp.bank_name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                    <Lock size={14} color="var(--primary)" />
                    <span style={{ fontWeight: 600, flex: 1 }}>{bp.bank_name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>••••••</span>
                    <button onClick={() => deletePassword(bp.bank_name)} className="btn-icon btn-icon-danger"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <input placeholder={ar ? 'اسم البنك' : 'Bank name'} value={newBankName} onChange={e => setNewBankName(e.target.value)} style={{ flex: '1 1 140px' }} />
              <input type="password" placeholder={ar ? 'كلمة السر' : 'Password'} value={newBankPassword} onChange={e => setNewBankPassword(e.target.value)} style={{ flex: '1 1 140px' }} />
              <button onClick={addPassword} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                <CheckCircle size={14} /> {ar ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* ── Import Success ── */}
        {importDone && (
          <div className="card mb-6" style={{ borderColor: 'var(--success)', background: 'var(--success-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <CheckCircle size={28} color="var(--success)" />
              <h2 style={{ margin: 0, color: 'var(--success)' }}>{ar ? 'تم الاستيراد بنجاح' : 'Import Successful'}</h2>
            </div>
            <div className="grid grid-3 mb-6">
              {[
                { label: ar ? 'معاملات جديدة'  : 'New Transactions', value: importSummary.created, color: 'var(--success)' },
                { label: ar ? 'مكررة (تخطت)'   : 'Duplicates Skipped', value: importSummary.skipped, color: 'var(--warning, #f59e0b)' },
                { label: ar ? 'بطاقات جديدة'   : 'New Cards', value: importSummary.cards, color: 'var(--primary)' },
              ].map(item => (
                <div key={item.label} className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, color: item.color, margin: 0 }}>{item.value}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>{item.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <button onClick={() => router.push('/transactions')} className="btn btn-primary">
                <Receipt size={16} /> {ar ? 'عرض المعاملات' : 'View Transactions'}
              </button>
              <button onClick={() => router.push('/dashboard')} className="btn btn-secondary">
                <CreditCard size={16} /> {ar ? 'الرئيسية' : 'Dashboard'}
              </button>
              <button onClick={reset} className="btn btn-secondary">
                <Upload size={16} /> {ar ? 'استيراد جديد' : 'New Import'}
              </button>
            </div>
          </div>
        )}

        {/* ── Drop Zone ── */}
        {!importDone && (
          <div
            className="card mb-4"
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => !processing && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
              background: dragOver ? 'var(--primary-bg)' : undefined,
              cursor: processing ? 'default' : 'pointer',
              textAlign: 'center',
              padding: files.length ? 'var(--space-6)' : 'var(--space-12)',
              transition: 'all 0.2s',
            }}
          >
            <Upload size={36} style={{ color: 'var(--primary)', margin: '0 auto var(--space-3)' }} />
            <p style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              {files.length > 0
                ? (ar ? `${files.length} ملف — اسحب المزيد أو اضغط للإضافة` : `${files.length} file(s) added — drag more or click to add`)
                : (ar ? 'اسحب ملفاتك هنا أو اضغط للاختيار' : 'Drag files here or click to select')}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
              PDF {ar ? 'أو صورة' : 'or image'} — {ar ? 'حتى 15 ملف' : 'up to 15 files'} — 25 MB {ar ? 'لكل ملف' : 'each'}
              {savedPasswords.length > 0 && (
                <span style={{ color: 'var(--success)', marginInlineStart: 8 }}>
                  · {savedPasswords.length} {ar ? 'كلمة سر محفوظة' : 'password(s) saved'}
                </span>
              )}
            </p>
            <input ref={fileInputRef} type="file" accept=".pdf,image/*" multiple
              onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
              style={{ display: 'none' }} />
          </div>
        )}

        {/* ── File List ── */}
        {files.length > 0 && !importDone && (
          <div className="card mb-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
              <FileText size={18} />
              <h3 style={{ margin: 0 }}>
                {ar ? `الملفات (${files.length}/15)` : `Files (${files.length}/15)`}
              </h3>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap', marginInlineStart: 'auto' }}>
                {doneFiles > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13} /> {doneFiles} {ar ? 'تم' : 'done'}</span>}
                {errorFiles > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={13} /> {errorFiles} {ar ? 'خطأ' : 'error'}</span>}
                {pwFiles > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--warning, #f59e0b)', display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={13} /> {pwFiles} {ar ? 'بكلمة سر' : 'need password'}</span>}
                <button onClick={processAll} disabled={processing || !canProcess} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  {processing
                    ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {ar ? `تحليل ${currentIdx + 1}/${files.length}` : `Analysing ${currentIdx + 1}/${files.length}`}</>
                    : <><PlayCircle size={15} /> {ar ? 'تحليل الكل' : 'Analyse All'}</>}
                </button>
              </div>
            </div>

            {/* Progress */}
            {processing && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--primary)', borderRadius: 99, width: `${((currentIdx + 1) / files.length) * 100}%`, transition: 'width 0.4s ease' }} />
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4, textAlign: 'center' }}>
                  {ar ? `جاري تحليل الملف ${currentIdx + 1} من ${files.length}…` : `Analysing file ${currentIdx + 1} of ${files.length}…`}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {files.map((entry, i) => (
                <div key={entry.id} style={{
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
                  background: entry.status === 'done' ? 'var(--success-bg)' : entry.status === 'error' ? 'var(--danger-bg)' : entry.status === 'processing' ? 'var(--primary-bg)' : undefined,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {statusIcon(entry.status)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.88rem' }}>
                        {entry.file.name}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                        {(entry.file.size / 1024).toFixed(0)} KB
                        {entry.status === 'done' && entry.transactions && (
                          <span style={{ color: 'var(--success)', marginInlineStart: 8 }}>
                            · {entry.transactions.length} {ar ? 'معاملة' : 'txns'} · {entry.cardInfo?.bank_name}
                          </span>
                        )}
                        {entry.error && (
                          <span style={{ color: entry.status === 'password_required' ? 'var(--warning, #f59e0b)' : 'var(--danger)', marginInlineStart: 8 }}>
                            · {entry.error}
                          </span>
                        )}
                      </p>
                    </div>
                    {entry.status !== 'processing' && (
                      <button onClick={() => removeFile(entry.id)} className="btn btn-secondary" style={{ padding: '4px 8px', flexShrink: 0 }}><X size={14} /></button>
                    )}
                  </div>

                  {/* Card picker */}
                  {entry.status === 'done' && !entry.matchedCardId && existingCards.length > 0 && (
                    <div style={{ marginTop: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: 'var(--space-2) var(--space-3)', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.3)' }}>
                      <CreditCard size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {ar ? 'ربط بكارت:' : 'Link to card:'}
                      </span>
                      <select
                        value={entry.selectedCardId || ''}
                        onChange={e => setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, selectedCardId: e.target.value || undefined } : f))}
                        style={{ flex: '1 1 200px', fontSize: '0.82rem', padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg)' }}
                      >
                        <option value="">{ar ? 'إنشاء كارت جديد تلقائياً' : 'Create new card automatically'}</option>
                        {existingCards.map(c => (
                          <option key={c.id} value={c.id}>{c.card_name} {c.card_last_four ? `•••• ${c.card_last_four}` : ''} — {c.bank_name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Auto-match */}
                  {entry.status === 'done' && entry.matchedCardId && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--success)' }}>
                      <CheckCircle size={13} />
                      <span>{ar ? `تم ربطه تلقائياً بـ` : 'Auto-linked to'} <strong>{entry.matchedCardName}</strong></span>
                    </div>
                  )}

                  {/* Password input */}
                  {entry.status === 'password_required' && (
                    <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Lock size={14} color="#f59e0b" />
                      <div style={{ position: 'relative', flex: '1 1 180px' }}>
                        <input
                          type={showPwInput[entry.id] ? 'text' : 'password'}
                          placeholder={ar ? 'كلمة سر الـ PDF' : 'PDF password'}
                          value={entry.password || ''}
                          onChange={e => setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, password: e.target.value } : f))}
                          style={{ width: '100%', paddingInlineEnd: 32 }}
                        />
                        <button onClick={() => setShowPwInput(p => ({ ...p, [entry.id]: !p[entry.id] }))} style={{ position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}>
                          {showPwInput[entry.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={entry.savePassword !== false} onChange={e => setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, savePassword: e.target.checked } : f))} />
                        {ar ? 'حفظ كلمة السر' : 'Save password'}
                      </label>
                      <button onClick={() => setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'waiting' } : f))} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }}>
                        {ar ? 'تجديد' : 'Retry'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {hasResults && !importDone && (
          <div className="card">
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
              <Receipt size={20} />
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                {ar ? `المعاملات (${allTransactions.length})` : `Transactions (${allTransactions.length})`}
              </h2>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginInlineStart: 'auto' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {ar ? 'محدد:' : 'Selected:'} <strong>{selectedCount}</strong>
                </span>
                <button onClick={toggleAll} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '3px 9px' }}>
                  {allTransactions.every(t => t.selected) ? (ar ? 'إلغاء الكل' : 'Deselect All') : (ar ? 'تحديد الكل' : 'Select All')}
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-4 mb-6">
              {[
                { label: ar ? 'المشتريات' : 'Purchases', value: totalPurchases, color: 'var(--danger)', icon: <TrendingDown size={15} />, currency: true },
                { label: ar ? 'الدفعات'  : 'Payments',  value: totalPayments, color: 'var(--success)', icon: <TrendingUp size={15} />, currency: true },
                { label: ar ? 'الصافي'   : 'Net',       value: Math.abs(totalPurchases - totalPayments), color: totalPurchases > totalPayments ? 'var(--danger)' : 'var(--success)', icon: <Banknote size={15} />, currency: true },
                { label: ar ? 'البنوك'   : 'Banks',     value: uniqueBanks.length, color: 'var(--primary)', icon: <Building2 size={15} />, currency: false },
              ].map(item => (
                <div key={item.label} className="card" style={{ padding: 'var(--space-3)', textAlign: 'center', background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', color: item.color, marginBottom: 4 }}>{item.icon}</div>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: item.color, margin: 0 }}>
                    {item.currency ? <>{formatAmount(item.value as number)} <CurrencySymbol code="AED" size={11} /></> : item.value}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>{item.label}</p>
                </div>
              ))}
            </div>

            {/* Per-bank buttons */}
            {uniqueBanks.length > 1 && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                {uniqueBanks.map(bank => {
                  const sel = allTransactions.filter(t => t._bankName === bank && t.selected).length;
                  const tot = allTransactions.filter(t => t._bankName === bank).length;
                  return (
                    <button key={bank} onClick={() => toggleBank(bank)} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
                      <Building2 size={12} /> {bank} ({sel}/{tot})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Table */}
            <div className="card-table" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: 'var(--space-2)', width: 32, textAlign: 'center' }}>
                      <input type="checkbox" checked={allTransactions.every(t => t.selected)} onChange={toggleAll} />
                    </th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)' }}>{ar ? 'البنك' : 'Bank'}</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)' }}>{ar ? 'التاريخ' : 'Date'}</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)' }}>{ar ? 'الوصف' : 'Description'}</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)' }}>{ar ? 'النوع' : 'Type'}</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'end',  color: 'var(--text-secondary)' }}>{ar ? 'المبلغ' : 'Amount'}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTxns.map((txn, idx) => {
                    const isExp = ['purchase', 'withdrawal'].includes(txn.type);
                    return (
                      <tr key={idx} onClick={() => toggleTxn(idx)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: txn.selected ? 1 : 0.35, transition: 'opacity 0.15s' }}>
                        <td style={{ padding: 'var(--space-2)', textAlign: 'center' }}>
                          <input type="checkbox" checked={!!txn.selected} onChange={() => toggleTxn(idx)} onClick={e => e.stopPropagation()} />
                        </td>
                        <td style={{ padding: 'var(--space-2)', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>{txn._bankName || '—'}</span>
                        </td>
                        <td style={{ padding: 'var(--space-2)', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{txn.date}</td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <p style={{ margin: 0, fontWeight: 500 }}>{txn.merchant}</p>
                          {txn.category && <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{txn.category}</p>}
                        </td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <span className="transaction-badge" data-type={txn.type} style={{ fontSize: '0.72rem' }}>
                            {(TXN_LABELS[txn.type] ?? {})[ar ? 'ar' : 'en'] || txn.type}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--space-2)', textAlign: 'end', fontWeight: 700, color: isExp ? 'var(--danger)' : 'var(--success)', whiteSpace: 'nowrap' }}>
                          {isExp ? '-' : '+'}{formatAmount(txn.amount)} <CurrencySymbol code={txn.currency || 'AED'} size={11} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {allTransactions.length > 15 && (
              <button onClick={() => setShowAllTxns(v => !v)} className="btn btn-secondary" style={{ width: '100%', marginTop: 'var(--space-3)', fontSize: '0.85rem' }}>
                {showAllTxns
                  ? <><ChevronUp size={15} /> {ar ? 'عرض أقل' : 'Show less'}</>
                  : <><ChevronDown size={15} /> {ar ? `عرض كل ${allTransactions.length} معاملة` : `Show all ${allTransactions.length} transactions`}</>}
              </button>
            )}

            {/* Import bar */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleImport} disabled={importing || selectedCount === 0} className="btn btn-primary" style={{ minWidth: 180 }}>
                {importing
                  ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {ar ? 'جاري الحفظ…' : 'Saving…'}</>
                  : <><CheckCircle size={15} /> {ar ? `حفظ ${selectedCount} معاملة` : `Save ${selectedCount} transactions`}</>}
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {ar ? `من ${doneFiles} كشف · ${uniqueBanks.length} بنك` : `from ${doneFiles} statement(s) · ${uniqueBanks.length} bank(s)`}
              </span>
              <button onClick={reset} className="btn btn-secondary" style={{ marginInlineStart: 'auto' }}>
                <X size={15} /> {ar ? 'مسح الكل' : 'Clear All'}
              </button>
            </div>
          </div>
        )}

        {/* ── How it works ── */}
        {files.length === 0 && !importDone && (
          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>{ar ? 'كيف يعمل؟' : 'How it works'}</h3>
            <div className="grid grid-4">
              {[
                { step: '1', title: ar ? 'ارفع الكشوفات'   : 'Upload Statements', desc: ar ? 'حتى 15 ملف PDF أو صورة'          : 'Up to 15 PDF or image files at once' },
                { step: '2', title: ar ? 'تحليل تلقائي'    : 'Auto Analysis',     desc: ar ? 'كل ملف يُحلل بالتسلسل'            : 'Each file is processed in sequence' },
                { step: '3', title: ar ? 'راجع المعاملات'  : 'Review Transactions', desc: ar ? 'جدول موحد لكل البنوك'           : 'Unified table from all banks' },
                { step: '4', title: ar ? 'حفظ دفعة واحدة' : 'Save in One Click',  desc: ar ? 'كل المعاملات تتسجل في لحظة'      : 'All transactions saved instantly' },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: '0.85rem' }}>
                    {item.step}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, margin: '0 0 2px' }}>{item.title}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
