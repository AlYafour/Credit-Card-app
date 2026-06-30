'use client';

import { useStatementStore } from '@/app/store/statementStore';
import { useRouter } from 'next/navigation';
import { Loader2, FileText, CheckCircle } from 'lucide-react';

export default function StatementBgBadge() {
  const router = useRouter();
  const processing = useStatementStore(s => s.processing);
  const files = useStatementStore(s => s.files);
  const currentIdx = useStatementStore(s => s.currentIdx);
  const allTransactions = useStatementStore(s => s.allTransactions);
  const importDone = useStatementStore(s => s.importDone);

  const doneFiles = files.filter(f => f.status === 'done').length;
  const totalFiles = files.length;

  // Show when: actively processing (on any page) or has unimported results (on other pages)
  if (!processing && (allTransactions.length === 0 || importDone)) return null;

  return (
    <button
      onClick={() => router.push('/statement')}
      className="stmt-bg-badge"
      title={processing ? 'جاري تحليل الكشوفات...' : 'عرض نتائج التحليل'}
    >
      {processing ? (
        <>
          <Loader2 size={14} className="stmt-bg-spin" />
          <span className="stmt-bg-text">
            {doneFiles}/{totalFiles}
          </span>
        </>
      ) : (
        <>
          <FileText size={14} />
          <span className="stmt-bg-text">
            {allTransactions.filter(t => t.selected).length}
          </span>
        </>
      )}
    </button>
  );
}
