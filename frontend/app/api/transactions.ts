import api from './client';
import type { Transaction, TransactionCreateRequest, ApiResponse, MonthlySummary } from '@/types';

export type { Transaction };

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  next: string | null;
  previous: string | null;
}

export const transactionsAPI = {
  list: async (params?: {
    card_id?: string;
    start_date?: string;
    end_date?: string;
    transaction_type?: string;
    merchant_name?: string;
    expense_type?: string;
    category?: string;
    merchant_group_id?: string;
    project_id?: string;
    approval_status?: string;
    amount_min?: number;
    amount_max?: number;
    sort?: string;
    page?: number;
    per_page?: number;
    include_deleted?: boolean;
  }): Promise<PaginatedTransactions> => {
    const response = await api.get('/transactions', { params });
    // Handle both paginated and non-paginated responses
    const data = response.data;
    if (data.items !== undefined) return data as PaginatedTransactions;
    // Legacy flat array
    return { items: data, total: data.length, page: 1, per_page: data.length, total_pages: 1, next: null, previous: null };
  },

  submitApproval: async (id: string): Promise<Transaction> => {
    const response = await api.post(`/transactions/${id}/submit-approval/`);
    return response.data;
  },

  approve: async (id: string, note?: string): Promise<Transaction> => {
    const response = await api.post(`/transactions/${id}/approve/`, { note });
    return response.data;
  },

  reject: async (id: string, note?: string): Promise<Transaction> => {
    const response = await api.post(`/transactions/${id}/reject/`, { note });
    return response.data;
  },

  uploadReceipt: async (id: string, file: File): Promise<{ receipt_url: string }> => {
    const formData = new FormData();
    formData.append('receipt', file);
    const response = await api.post(`/transactions/${id}/upload-receipt/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteReceipt: async (id: string): Promise<void> => {
    await api.delete(`/transactions/${id}/delete-receipt/`);
  },

  restore: async (id: string): Promise<Transaction> => {
    const response = await api.post(`/transactions/${id}/restore/`);
    return response.data;
  },

  exportExcel: (params?: {
    card_id?: string;
    start_date?: string;
    end_date?: string;
    transaction_type?: string;
    merchant_name?: string;
    expense_type?: string;
    merchant_group_id?: string;
  }): string => {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => v && qs.set(k, String(v)));
    }
    return `${base}/api/v1/transactions/export/?${qs.toString()}`;
  },

  importExcel: async (file: File): Promise<{ created: number; errors: string[]; total_rows: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/transactions/import/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  get: async (id: string): Promise<Transaction> => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },

  create: async (data: TransactionCreateRequest): Promise<Transaction> => {
    const response = await api.post('/transactions', data);
    return response.data;
  },

  update: async (id: string, data: Partial<TransactionCreateRequest>): Promise<Transaction> => {
    const response = await api.put(`/transactions/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/transactions/${id}`);
  },

  monthlySummary: async (year: number, month: number): Promise<MonthlySummary> => {
    const response = await api.get('/transactions/summary/monthly', {
      params: { year, month },
    });
    return response.data;
  },
};
