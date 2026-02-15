/**
 * Team Management API
 */
import apiClient from './client';

export const teamAPI = {
  createTeam: async (name, description = '') => {
    const response = await apiClient.post('/teams', {
      name,
      description,
    });
    return response.data;
  },

  getTeam: async (teamId) => {
    const response = await apiClient.get(`/teams/${teamId}`);
    return response.data;
  },

  addMember: async (teamId, userId, role = 'qa_member') => {
    const response = await apiClient.post(`/teams/${teamId}/members`, {
      user_id: userId,
      role,
    });
    return response.data;
  },

  removeMember: async (teamId, userId) => {
    const response = await apiClient.delete(`/teams/${teamId}/members/${userId}`);
    return response.data;
  },

  updateMemberRole: async (teamId, userId, role) => {
    const response = await apiClient.put(`/teams/${teamId}/members/${userId}/role`, {
      role,
    });
    return response.data;
  },

  deleteTeam: async (teamId) => {
    const response = await apiClient.delete(`/teams/${teamId}`);
    return response.data;
  },
};
