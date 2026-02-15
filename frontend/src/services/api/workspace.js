/**
 * Workspace API
 */
import apiClient from './client';

export const workspaceAPI = {
  getWorkspaces: async () => {
    const response = await apiClient.get('/workspaces');
    return response.data;
  },

  switchWorkspace: async (teamId = null) => {
    const response = await apiClient.put('/workspaces/active', {
      team_id: teamId,
    });
    return response.data;
  },
};
