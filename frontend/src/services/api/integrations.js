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

  /** Start a cancellable sync job for any action (returns {promise, cancel})
   *  action: 'full' | 'attach' | 'comment'
   */
  getCancelableSync: (integrationType, ticketId, generationId, action = 'full') => {
    const endpointMap = {
      full:    '/integrations/sync/full-sync',
      attach:  '/integrations/sync/attach-excel',
      comment: '/integrations/sync/add-comment',
    };

    const endpoint = endpointMap[action];
    if (!endpoint) throw new Error(`Unknown sync action: ${action}`);

    let jobId = null;
    let _resolve = null;
    let _reject = null;
    let _cancelled = false;
    let _pollController = null;

    const promise = new Promise((res, rej) => { _resolve = res; _reject = rej; });

    (async () => {
      try {
        const response = await apiClient.post(endpoint, {
          integration_type: integrationType,
          ticket_id: ticketId,
          generation_id: generationId,
        });
        jobId = response.data.job_id;

        if (_cancelled) {
          apiClient.post(`/integrations/sync/cancel/${jobId}`).catch(() => {});
          if (_reject) { _reject(new Error('sync_cancelled')); _reject = null; }
          return;
        }

        // Poll loop
        while (!_cancelled) {
          _pollController = new AbortController();
          let res;
          try {
            res = await apiClient.get(`/integrations/sync/job-status/${jobId}`, {
              signal: _pollController.signal,
            });
          } catch (e) {
            if (_cancelled || e.code === 'ERR_CANCELED') return;
            if (_reject) { _reject(e); _reject = null; }
            return;
          }
          const status = res.data.status;
          if (status === 'completed') { if (_resolve) { _resolve(res.data.result); _resolve = null; } return; }
          if (status === 'error')     { if (_reject)  { _reject(new Error(res.data.error || 'Sync failed')); _reject = null; } return; }
          if (status === 'cancelled') { if (_reject)  { _reject(new Error('sync_cancelled')); _reject = null; } return; }
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (e) {
        if (_reject) { _reject(e); _reject = null; }
      }
    })();

    const cancel = async () => {
      _cancelled = true;
      if (_pollController) _pollController.abort();
      if (_reject) { _reject(new Error('sync_cancelled')); _reject = null; }
      if (jobId) apiClient.post(`/integrations/sync/cancel/${jobId}`).catch(() => {});
    };

    return { promise, cancel };
  },
};
