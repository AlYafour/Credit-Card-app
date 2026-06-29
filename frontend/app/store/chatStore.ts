'use client';

import { create } from 'zustand';
import { chatAPI, type ChatMessage, type ChatSession } from '../api/chat';
import toast from 'react-hot-toast';

interface ChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  isSending: boolean;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (message: string, image?: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  startNewSession: () => void;
  deleteSession: (sessionId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  messages: [],
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  isSending: false,

  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),

  sendMessage: async (message: string, image?: string) => {
    const { currentSessionId } = get();
    set((s) => ({ messages: [...s.messages, { role: 'user', content: message }], isSending: true }));
    try {
      const res = await chatAPI.send(message, currentSessionId || undefined, image);
      set((s) => ({
        messages: [...s.messages, { role: 'assistant', content: res.response }],
        currentSessionId: res.session_id,
        isSending: false,
      }));
      // Show toast for performed actions
      if (res.actions && res.actions.length > 0) {
        res.actions.forEach((action: any) => {
          if (action.type === 'transaction_added') {
            toast.success(`✅ معاملة مضافة: ${action.amount} AED${action.merchant ? ` — ${action.merchant}` : ''}`);
          } else if (action.type === 'bulk_transactions_added') {
            toast.success(`✅ تم استيراد ${action.count} معاملة بنجاح`);
          } else if (action.type === 'transaction_deleted') {
            toast.success(`🗑️ تم حذف المعاملة: ${action.merchant || ''} ${action.amount} AED`);
          } else if (action.type === 'transaction_updated') {
            toast.success(`✏️ تم تحديث المعاملة`);
          } else if (action.type === 'card_added') {
            toast.success(`✅ بطاقة مضافة: ${action.card_name}${action.card_last_four ? ` (••••${action.card_last_four})` : ''}`);
          } else if (action.type === 'card_updated') {
            toast.success(`✏️ تم تحديث البطاقة`);
          } else if (action.type === 'card_deleted') {
            toast.success(`🗑️ تم حذف البطاقة: ${action.card_name || ''}`);
          } else if (action.type === 'cards_merged') {
            toast.success(`🔀 تم دمج ${action.transactions_moved} معاملة من ${action.source_card} إلى ${action.target_card}`);
          } else if (action.type === 'data_cleared') {
            toast.success(`🗑️ تم مسح ${action.transactions_deleted} معاملة و ${action.statements_deleted} كشف`);
          }
        });
      }
      // Reload sessions to get the new title
      get().loadSessions();
    } catch {
      set((s) => ({
        messages: [...s.messages, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }],
        isSending: false,
      }));
    }
  },

  loadSessions: async () => {
    try {
      const sessions = await chatAPI.getSessions();
      set({ sessions });
    } catch { /* silent */ }
  },

  loadMessages: async (sessionId: string) => {
    set({ isLoading: true, currentSessionId: sessionId });
    try {
      const messages = await chatAPI.getMessages(sessionId);
      set({ messages, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  startNewSession: () => set({ currentSessionId: null, messages: [] }),

  deleteSession: async (sessionId: string) => {
    try {
      await chatAPI.deleteSession(sessionId);
      const { currentSessionId } = get();
      if (currentSessionId === sessionId) set({ currentSessionId: null, messages: [] });
      get().loadSessions();
    } catch { /* silent */ }
  },
}));
