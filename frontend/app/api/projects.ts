import api from './client';
import type { Project } from '@/types';

export const projectsAPI = {
  list: async (): Promise<Project[]> => {
    const response = await api.get('/projects/');
    return response.data;
  },

  get: async (id: string): Promise<Project> => {
    const response = await api.get(`/projects/${id}/`);
    return response.data;
  },

  create: async (data: { name: string; color?: string; description?: string }): Promise<Project> => {
    const response = await api.post('/projects/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{ name: string; color: string; description: string; is_active: boolean }>): Promise<Project> => {
    const response = await api.patch(`/projects/${id}/`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}/`);
  },
};
