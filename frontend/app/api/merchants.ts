import api from './client';

export interface Merchant {
  merchant_name: string;
  arabic_name?: string | null;
  transaction_count: number;
  total_amount: number;
  last_transaction_date: string;
}

export const merchantsAPI = {
  list: async (): Promise<{ items: Merchant[] }> => {
    const response = await api.get('/merchants/');
    return response.data;
  },
  translate: async (names: string[]): Promise<Record<string, string>> => {
    const response = await api.post('/merchants/translate/', { names });
    return response.data.translations;
  },
};
