'use client';

import { create } from 'zustand';
import { cardsAPI } from '../api/cards';
import toast from 'react-hot-toast';

// ── Types ──────────────────────────────────────────────────────────────────

export type CardInfo = {
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

export type ParsedTxn = {
  date: string; merchant: string; amount: number; type: string;
  currency: string; category?: string; selected?: boolean;
  _fileIndex?: number; _fileName?: string; _bankName?: string;
  _isDuplicate?: boolean;
};

export type FileStatus = 'waiting' | 'processing' | 'done' | 'error' | 'password_required';

export type FileEntry = {
  id: string; file: File; base64: string; status: FileStatus;
  error?: string; cardInfo?: CardInfo; transactions?: ParsedTxn[];
  matchedCardId?: string; matchedCardName?: string; selectedCardId?: string;
  passwordRequired?: boolean; password?: string; savePassword?: boolean;
  expanded?: boolean;
};

// ── Duplicate helpers ──────────────────────────────────────────────────────

function txnKey(t: ParsedTxn) {
  return `${t.date}|${(t.merchant || '').toLowerCase().trim()}|${t.amount}|${t.currency}`;
}

function markDuplicates(txns: ParsedTxn[]): ParsedTxn[] {
  const seen = new Map<string, number>();
  return txns.map((t, i) => {
    const k = txnKey(t);
    if (seen.has(k)) {
      return { ...t, _isDuplicate: true, selected: false };
    }
    seen.set(k, i);
    return { ...t, _isDuplicate: false };
  });
}

// ── Store ──────────────────────────────────────────────────────────────────

interface StatementStore {
  files: FileEntry[];
  allTransactions: ParsedTxn[];
  processing: boolean;
  currentIdx: number;
  importDone: boolean;
  importSummary: { created: number; skipped: number; cards: number };

  addFiles: (entries: FileEntry[]) => string[];   // returns list of skipped duplicate filenames
  removeFile: (id: string) => void;
  updateFile: (id: string, patch: Partial<FileEntry>) => void;
  toggleTxn: (idx: number) => void;
  toggleAll: () => void;
  toggleBank: (bank: string) => void;
  reset: () => void;

  processAll: (opts: { ar: boolean; preselectedCardId?: string }) => Promise<void>;
  importSelected: (opts: { ar: boolean; existingFiles: FileEntry[] }) => Promise<void>;
  setImportDone: (v: boolean, summary?: { created: number; skipped: number; cards: number }) => void;
}

export const useStatementStore = create<StatementStore>((set, get) => ({
  files: [],
  allTransactions: [],
  processing: false,
  currentIdx: -1,
  importDone: false,
  importSummary: { created: 0, skipped: 0, cards: 0 },

  // ── File management ──────────────────────────────────────────────────────

  addFiles: (entries) => {
    const existing = get().files;
    const skipped: string[] = [];
    const toAdd: FileEntry[] = [];

    for (const entry of entries) {
      const isDup = existing.some(
        e => e.file.name === entry.file.name && e.file.size === entry.file.size
      );
      if (isDup) {
        skipped.push(entry.file.name);
      } else {
        toAdd.push(entry);
      }
    }

    if (toAdd.length) {
      set(s => ({ files: [...s.files, ...toAdd].slice(0, 15) }));
    }
    return skipped;
  },

  removeFile: (id) => {
    set(s => ({
      files: s.files.filter(f => f.id !== id),
      allTransactions: s.allTransactions.filter(t => {
        const fileIdx = s.files.findIndex(f => f.id === id);
        return t._fileIndex !== fileIdx;
      }),
    }));
  },

  updateFile: (id, patch) => {
    set(s => ({ files: s.files.map(f => f.id === id ? { ...f, ...patch } : f) }));
  },

  toggleTxn: (idx) => {
    set(s => ({ allTransactions: s.allTransactions.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t) }));
  },

  toggleAll: () => {
    const all = get().allTransactions.every(t => t.selected);
    set(s => ({ allTransactions: s.allTransactions.map(t => ({ ...t, selected: !all })) }));
  },

  toggleBank: (bank) => {
    const all = get().allTransactions.filter(t => t._bankName === bank).every(t => t.selected);
    set(s => ({ allTransactions: s.allTransactions.map(t => t._bankName === bank ? { ...t, selected: !all } : t) }));
  },

  reset: () => set({ files: [], allTransactions: [], processing: false, currentIdx: -1, importDone: false, importSummary: { created: 0, skipped: 0, cards: 0 } }),

  setImportDone: (v, summary) => set({ importDone: v, ...(summary ? { importSummary: summary } : {}) }),

  // ── Core: process all files ──────────────────────────────────────────────
  // This action runs even when the /statement component is unmounted.
  // State updates via set() are reflected when user navigates back.

  processAll: async ({ ar, preselectedCardId }) => {
    const waiting = get().files.filter(f =>
      f.status === 'waiting' || f.status === 'error' ||
      (f.status === 'password_required' && f.password)
    );
    if (!waiting.length) {
      toast(ar ? 'لا توجد ملفات للمعالجة' : 'No files to process', { icon: '⚠️' });
      return;
    }

    set({ processing: true });
    const collected: ParsedTxn[] = [...get().allTransactions];

    const currentFiles = get().files;
    for (let i = 0; i < currentFiles.length; i++) {
      const entry = get().files[i];
      if (!entry) continue;
      if (entry.status === 'done') continue;
      if (entry.status === 'password_required' && !entry.password) continue;
      if (entry.status === 'processing') continue;

      set({ currentIdx: i });
      set(s => ({ files: s.files.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f) }));

      const latest = get().files[i];
      if (!latest) continue;

      try {
        const result = await cardsAPI.parseStatement(latest.base64, latest.file.type, {
          pdf_password: latest.password || undefined,
          save_password: latest.savePassword,
        });

        if (result.error === 'pdf_password_required') {
          set(s => ({ files: s.files.map((f, idx) => idx === i ? { ...f, status: 'password_required', passwordRequired: true, error: ar ? 'محمي بكلمة سر' : 'Password protected' } : f) }));
          continue;
        }
        if (result.error === 'pdf_password_wrong') {
          set(s => ({ files: s.files.map((f, idx) => idx === i ? { ...f, status: 'password_required', passwordRequired: true, error: ar ? 'كلمة السر خاطئة' : 'Wrong password' } : f) }));
          continue;
        }
        if (result.error) {
          set(s => ({ files: s.files.map((f, idx) => idx === i ? { ...f, status: 'error', error: result.error } : f) }));
          continue;
        }

        const bankName = result.card_info?.bank_name || latest.file.name;
        const txns: ParsedTxn[] = (result.transactions || []).map((t: ParsedTxn) => ({
          ...t, selected: true, _fileIndex: i, _fileName: latest.file.name, _bankName: bankName,
        }));
        collected.push(...txns);

        set(s => ({
          files: s.files.map((f, idx) => idx === i ? {
            ...f, status: 'done', cardInfo: result.card_info, transactions: txns,
            matchedCardId: result.matched_card_id, matchedCardName: result.matched_card_name,
            selectedCardId: result.matched_card_id ? undefined : preselectedCardId,
          } : f),
        }));

      } catch (err: unknown) {
        const axErr = err as { response?: { data?: { error?: string } } };
        const code = axErr?.response?.data?.error;
        if (code === 'pdf_password_required') {
          set(s => ({ files: s.files.map((f, idx) => idx === i ? { ...f, status: 'password_required', passwordRequired: true, error: ar ? 'محمي بكلمة سر' : 'Password protected' } : f) }));
        } else if (code === 'pdf_password_wrong') {
          set(s => ({ files: s.files.map((f, idx) => idx === i ? { ...f, status: 'password_required', passwordRequired: true, error: ar ? 'كلمة السر خاطئة' : 'Wrong password' } : f) }));
        } else {
          set(s => ({ files: s.files.map((f, idx) => idx === i ? { ...f, status: 'error', error: ar ? 'فشل الاتصال' : 'Connection failed' } : f) }));
        }
      }
    }

    // Mark duplicates within batch
    const withDups = markDuplicates(collected);
    const dupCount = withDups.filter(t => t._isDuplicate).length;

    set({ allTransactions: withDups, processing: false, currentIdx: -1 });

    const doneCount = withDups.filter(t => !t._isDuplicate && t.selected).length;
    if (dupCount > 0) {
      toast(
        ar
          ? `تم تحليل ${withDups.length} معاملة · ${dupCount} مكررة (تم إلغاء تحديدها)`
          : `Analysed ${withDups.length} txns · ${dupCount} duplicate(s) deselected`,
        { icon: '⚠️', duration: 5000 }
      );
    } else {
      toast.success(ar ? `تم تحليل ${doneCount} معاملة` : `Analysed ${doneCount} transactions`);
    }
  },

  // ── Import selected transactions ─────────────────────────────────────────

  importSelected: async ({ ar, existingFiles }) => {
    const { allTransactions, files } = get();
    const selected = allTransactions.filter(t => t.selected && !t._isDuplicate);
    if (!selected.length) {
      toast.error(ar ? 'اختر معاملة واحدة على الأقل' : 'Select at least one transaction');
      return;
    }

    let totalCreated = 0, totalSkipped = 0, newCards = 0;

    const byFile = new Map<number, { cardInfo: CardInfo; txns: ParsedTxn[]; cardId?: string; fileBase64?: string; fileType?: string; fileName?: string }>();
    for (const txn of selected) {
      const fi = txn._fileIndex ?? 0;
      if (!byFile.has(fi)) {
        const fe = files[fi] || existingFiles[fi];
        byFile.set(fi, {
          cardInfo: fe?.cardInfo || {},
          txns: [],
          cardId: fe?.selectedCardId || fe?.matchedCardId,
          fileBase64: fe?.base64,
          fileType: fe?.file?.type,
          fileName: fe?.file?.name,
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

    set({ importDone: true, importSummary: { created: totalCreated, skipped: totalSkipped, cards: newCards } });
    toast.success(ar ? `تم حفظ ${totalCreated} معاملة` : `Saved ${totalCreated} transactions`);
  },
}));
