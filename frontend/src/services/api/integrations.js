/**
 * Integration API
 * Jira, Azure DevOps - config management, ticket fetching, and sync operations
 */
import apiClient from './client';

export const integrationAPI = {
  /** Get all configured integrations for the current workspace */
  getConfigs: async () => {
    const response = await apiClient.get('/integrations/config');
    return response.data;
  },

  /** Get a specific integration config */
  getConfig: async (integrationType) => {
    const response = await apiClient.get(`/integrations/config/${integrationType}`);
    return response.data;
  },

  /** Save integration config */
  saveConfig: async (integrationType, credentials, config) => {
    const response = await apiClient.post('/integrations/config', {
      integration_type: integrationType,
      credentials,
      config,
    });
    return response.data;
  },

  /** Delete integration config */
  deleteConfig: async (integrationType) => {
    const response = await apiClient.delete(`/integrations/config/${integrationType}`);
    return response.data;
  },

  /** Test integration connection */
  testConnection: async (integrationType, credentials, config) => {
    const response = await apiClient.post('/integrations/test-connection', {
      integration_type: integrationType,
      credentials,
      config,
    });
    return response.data;
  },

  /** Fetch a ticket from an integration */
  fetchTicket: async (integrationType, ticketId) => {
    const response = await apiClient.post('/integrations/fetch-ticket', {
      integration_type: integrationType,
      ticket_id: ticketId,
    });
    return response.data;
  },

  /** View decrypted credentials (requires password verification) */
  viewCredentials: async (integrationType, password) => {
    const response = await apiClient.post(`/integrations/view-credentials/${integrationType}`, {
      password,
    });
    return response.data;
  },

  /** Attach Excel file to a ticket */
  attachExcel: async (integrationType, ticketId, generationId) => {
    const response = await apiClient.post('/integrations/sync/attach-excel', {
      integration_type: integrationType,
      ticket_id: ticketId,
      generation_id: generationId,
    });
    return response.data;
  },

  /** Add test summary comment to a ticket */
  addComment: async (integrationType, ticketId, generationId, comment = null) => {
    const response = await apiClient.post('/integrations/sync/add-comment', {
      integration_type: integrationType,
      ticket_id: ticketId,
      generation_id: generationId,
      comment,
    });
    return response.data;
  },

  /** Full sync: attach Excel + add comment to ticket */
  fullSync: async (integrationType, ticketId, generationId) => {
    const response = await apiClient.post('/integrations/sync/full-sync', {
      integration_type: integrationType,
      ticket_id: ticketId,
      generation_id: generationId,
    });
    return response.data;
  },
};
