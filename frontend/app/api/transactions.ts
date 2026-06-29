import api from './client';
import type { Transaction, TransactionCreateRequest, ApiResponse, MonthlySummary } from '@/types';

export type { Transaction };

export const transactionsAPI = {
  list: async (params?: {
    card_id?: string;
    start_date?: string;
    end_date?: string;
    transaction_type?: string;
    merchant_name?: string;
    page?: number;
    per_page?: number;
  }): Promise<ApiResponse<Transaction>> => {
    const response = await api.get('/transactions', { params });
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
