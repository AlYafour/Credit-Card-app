import api from './client';
import type { Card, CardCreateRequest, CardUpdateRequest, ApiResponse } from '@/types';

export type { Card };

export const cardsAPI = {
  list: async (params?: { bank_name?: string; page?: number; per_page?: number }): Promise<ApiResponse<Card>> => {
    const response = await api.get('/cards', { params });
    return response.data;
  },

  get: async (id: string, reveal: boolean = false): Promise<Card> => {
    const response = await api.get(`/cards/${id}`, { params: { reveal: reveal.toString() } });
    return response.data;
  },

  create: async (data: CardCreateRequest): Promise<Card> => {
    const response = await api.post('/cards', data);
    return response.data;
  },

  update: async (id: string, data: CardUpdateRequest): Promise<Card> => {
    const response = await api.put(`/cards/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/cards/${id}`);
  },

  parseText: async (text: string) => {
    const response = await api.post('/cards/parse-text', { text });
    return response.data;
  },

  parseSMS: async (data: {
    sms_body: string;
    sender?: string;
    received_at?: string;
    auto_create?: boolean;
    card_id?: string;
  }) => {
    const response = await api.post('/cards/parse-sms', data);
    return response.data;
  },

  billingSummary: async (): Promise<{
    items: Array<{
      id: string;
      card_name: string;
      bank_name: string;
      card_last_four: string;
      credit_limit: number;
      current_balance: number;
      available_credit: number;
      payment_due_date: number | null;
      minimum_payment: number | null;
      currency: string;
    }>;
    total_owed: number;
    total_credit_limit: number;
    total_available: number;
    currency: string;
  }> => {
    const response = await api.get('/cards/billing-summary');
    return response.data;
  },

  extractDocument: async (fileBase64: string, fileType: string): Promise<{
    card_name?: string;
    bank_name?: string;
    card_number?: string;
    cardholder_name?: string;
    expiry_month?: string;
    expiry_year?: string;
    card_network?: string;
    credit_limit?: string;
    annual_fee?: string;
    late_payment_fee?: string;
    over_limit_fee?: string;
    minimum_payment_percentage?: string;
    statement_date?: string;
    payment_due_date?: string;
    account_manager_name?: string;
    account_manager_phone?: string;
    bank_emails?: string[];
    benefits?: { description: string; count: string | null; notes: string | null }[];
    error?: string;
  }> => {
    const response = await api.post('/cards/extract-document', { file: fileBase64, file_type: fileType });
    return response.data;
  },

  analytics: async (params?: {
    period?: 'month' | 'quarter' | 'year' | 'all' | 'custom';
    from_date?: string;
    to_date?: string;
    card_id?: string;
    category?: string;
  }): Promise<{
    period: string;
    date_from: string | null;
    date_to: string | null;
    totals: { purchases: number; payments: number; refunds: number; net_spending: number; net_after_payments: number };
    by_category: Array<{ category: string; total: number; count: number }>;
    by_card: Array<{
      card_id: string; card_name: string; bank_name: string; last_four: string; color_hex: string | null;
      total_purchases: number; count: number;
      points_earn_rate: number; points_value_fils: number;
      points_earned: number; points_value_aed: number;
    }>;
    monthly_trend: Array<{ month: string; purchases: number; payments: number; refunds: number }>;
    upcoming_payments: Array<{
      card_id: string; card_name: string; bank_name: string; card_last_four: string; color_hex: string | null;
      current_balance: number; credit_limit: number; minimum_payment: number;
      due_date: string | null; days_until: number | null; is_overdue: boolean; currency: string;
    }>;
    points_summary: { total_earned: number; total_value_aed: number };
  }> => {
    const response = await api.get('/cards/analytics', { params: params || {} });
    return response.data;
  },

  listStatements: async (): Promise<Array<{
    id: string; bank_name: string; card_name: string | null; card_last_four: string | null;
    cardholder_name: string | null; statement_period_from: string | null; statement_period_to: string | null;
    statement_balance: number | null; available_balance: number | null; credit_limit: number | null;
    payment_due_full_date: string | null; payment_due_day: number | null; minimum_payment: number | null;
    currency: string; transactions_imported: number; transactions_skipped: number;
    imported_at: string; card_id: string | null; card_color: string | null;
    has_file: boolean; file_name: string | null;
  }>> => {
    const response = await api.get('/statements/');
    return response.data;
  },

  getStatementFile: async (statementId: string): Promise<Blob> => {
    const response = await api.get(`/statements/${statementId}/file/`, { responseType: 'blob' });
    return response.data;
  },

  getStatementTransactions: async (statementId: string): Promise<{
    statement_id: string;
    count: number;
    transactions: Array<{ id: string; date: string; merchant: string | null; amount: number; type: string; currency: string; category: string | null }>;
  }> => {
    const response = await api.get(`/statements/${statementId}/transactions/`);
    return response.data;
  },

  updatePointsRate: async (cardId: string, points_earn_rate: number, points_value_fils: number): Promise<void> => {
    await api.patch(`/cards/${cardId}`, { points_earn_rate, points_value_fils });
  },

  getBankPasswords: async (): Promise<Array<{ id: string; bank_name: string; updated_at: string }>> => {
    const response = await api.get('/bank-passwords/');
    return response.data;
  },

  saveBankPassword: async (bankName: string, password: string): Promise<void> => {
    await api.post('/bank-passwords/save/', { bank_name: bankName, password });
  },

  deleteBankPassword: async (bankName: string): Promise<void> => {
    await api.delete(`/bank-passwords/${encodeURIComponent(bankName)}/`);
  },

  parseStatement: async (fileBase64: string, fileType: string, options?: {
    pdf_password?: string;
    save_password?: boolean;
    bank_name_hint?: string;
  }): Promise<{
    card_info: {
      bank_name?: string; card_name?: string; card_last_four?: string;
      cardholder_name?: string; credit_limit?: number; available_balance?: number;
      statement_balance?: number; statement_date?: number; payment_due_date?: number;
      payment_due_full_date?: string; minimum_payment?: number; minimum_payment_percentage?: number;
      annual_fee?: number; late_payment_fee?: number; over_limit_fee?: number;
      account_manager_name?: string; account_manager_phone?: string;
      bank_emails?: string[]; currency?: string;
      statement_period_from?: string; statement_period_to?: string;
    };
    transactions: Array<{
      date: string; merchant: string; amount: number;
      type: string; currency: string; category?: string;
    }>;
    transaction_count: number;
    matched_card_id?: string;
    matched_card_name?: string;
    password_saved?: boolean;
    error?: string;
  }> => {
    const response = await api.post('/cards/parse-statement', {
      file: fileBase64,
      file_type: fileType,
      pdf_password: options?.pdf_password,
      save_password: options?.save_password,
      bank_name_hint: options?.bank_name_hint,
    });
    return response.data;
  },

  importStatement: async (data: {
    card_info: Record<string, unknown>;
    transactions: Array<Record<string, unknown>>;
    card_id?: string;
    file?: string;
    file_type?: string;
    file_name?: string;
  }): Promise<{
    card: unknown;
    card_created: boolean;
    transactions_created: number;
    transactions_skipped: number;
    total_transactions: number;
    statement_id: string;
  }> => {
    const response = await api.post('/cards/import-statement', data);
    return response.data;
  },

  scanCardImage: async (imageBase64: string): Promise<{
    card_number?: string;
    cardholder_name?: string;
    expiry_month?: string;
    expiry_year?: string;
    cvv?: string;
    card_network?: string;
    bank_name?: string;
    error?: string;
  }> => {
    const response = await api.post('/cards/scan-image', { image: imageBase64 });
    return response.data;
  },
};
