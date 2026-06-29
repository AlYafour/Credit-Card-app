import api from './client';

export interface Cardholder {
  card_id: string;
  card_name: string;
  card_last_four: string;
  bank_name: string;
  card_ownership: 'supplementary' | 'joint';
  cardholder_name: string | null;
  color_hex: string | null;
  credit_limit: number | null;
  total_spent: number;
  monthly_spent: number;
  company_spent: number;
  personal_spent: number;
  transaction_count: number;
  last_activity: string | null;
}

export const cardholdersAPI = {
  list: async (): Promise<Cardholder[]> => {
    const res = await api.get('/cardholders/');
    return res.data;
  },
};
