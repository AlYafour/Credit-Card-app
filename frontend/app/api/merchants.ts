import api from './client';

export interface Merchant {
  merchant_name: string;
  transaction_count: number;
  total_amount: number;
  last_transaction_date: string;
}

export const merchantsAPI = {
  list: async (): Promise<{ items: Merchant[] }> => {
    const response = await api.get('/merchants/');
    return response.data;
  },
};
