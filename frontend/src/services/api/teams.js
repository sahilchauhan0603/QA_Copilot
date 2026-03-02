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

  addMember: async (teamId, publicUserId, role = 'qa_member') => {
    const response = await apiClient.post(`/teams/${teamId}/members`, {
      public_user_id: publicUserId,
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

  // ── Invitations ──

  /** Send a team invitation (identifier = email, username, or public user ID) */
  sendInvitation: async (teamId, identifier, role = 'qa_member') => {
    const response = await apiClient.post('/invitations/send', {
      team_id: teamId,
      identifier,
      role,
    });
    return response.data;
  },

  /** Get pending invitations for current user (inbox) */
  getMyInvitations: async () => {
    const response = await apiClient.get('/invitations');
    return response.data;
  },

  /** Accept or reject an invitation */
  respondToInvitation: async (invitationId, action) => {
    const response = await apiClient.post(`/invitations/${invitationId}/respond`, {
      action,  // 'accept' or 'reject'
    });
    return response.data;
  },
};
