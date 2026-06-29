import api from './client';

export interface MerchantRule {
  id: string;
  merchant_name: string;
  match_type: 'exact' | 'contains' | 'starts_with';
  created_at: string;
}

export interface MerchantGroup {
  id: string;
  name: string;
  group_type: 'company' | 'personal' | 'mixed';
  color: string;
  icon?: string;
  monthly_budget?: number | null;
  rules: MerchantRule[];
  transaction_count: number;
  total_spent: number;
  monthly_spent: number;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSummary {
  month: string;
  company: number;
  personal: number;
  unclassified: number;
  total: number;
}

export const merchantGroupsAPI = {
  list: async (): Promise<MerchantGroup[]> => {
    const res = await api.get('/merchant-groups/');
    return res.data.results ?? res.data;
  },

  create: async (data: Partial<MerchantGroup>): Promise<MerchantGroup> => {
    const res = await api.post('/merchant-groups/', data);
    return res.data;
  },

  update: async (id: string, data: Partial<MerchantGroup>): Promise<MerchantGroup> => {
    const res = await api.patch(`/merchant-groups/${id}/`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/merchant-groups/${id}/`);
  },

  addRule: async (groupId: string, rule: Omit<MerchantRule, 'id' | 'created_at'>): Promise<MerchantRule> => {
    const res = await api.post(`/merchant-groups/${groupId}/rules/`, rule);
    return res.data;
  },

  removeRule: async (groupId: string, ruleId: string): Promise<void> => {
    await api.delete(`/merchant-groups/${groupId}/rules/${ruleId}/`);
  },

  classifyAll: async (): Promise<{ classified: number }> => {
    const res = await api.post('/merchant-groups/classify/');
    return res.data;
  },

  summary: async (): Promise<ExpenseSummary> => {
    const res = await api.get('/merchant-groups/summary/');
    return res.data;
  },
};
