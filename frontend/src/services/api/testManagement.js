/**
 * Test Management Export API
 * Xray, Zephyr Scale, TestRail export operations
 */
import apiClient from './client';

export const testManagementAPI = {
  /** Export test cases to Xray */
  exportToXray: async (generationId, suiteName = null, ticketId = null) => {
    const response = await apiClient.post('/test-management/export-xray', {
      generation_id: generationId,
      suite_name: suiteName,
      ticket_id: ticketId,
    });
    return response.data;
  },

  /** Export test cases to Zephyr Scale */
  exportToZephyr: async (generationId, cycleName = null, ticketId = null) => {
    const response = await apiClient.post('/test-management/export-zephyr', {
      generation_id: generationId,
      cycle_name: cycleName,
      ticket_id: ticketId,
    });
    return response.data;
  },

  /** Export test cases to TestRail */
  exportToTestRail: async (generationId, suiteName, ticketId = null) => {
    const response = await apiClient.post('/test-management/export-testrail', {
      generation_id: generationId,
      suite_name: suiteName,
      ticket_id: ticketId,
    });
    return response.data;
  },

  /** Start a cancellable export job (returns { promise, cancel }) */
  getCancelableExport: (tool, generationId, suiteName = null, ticketId = null) => {
    let jobId = null;
    let cancelRequested = false;

    const startJob = async () => {
      let endpoint = '';
      let payload = { generation_id: generationId, ticket_id: ticketId };

      if (tool === 'xray') {
        endpoint = '/test-management/export-xray-job';
        payload.suite_name = suiteName;
      } else if (tool === 'zephyr') {
        endpoint = '/test-management/export-zephyr-job';
        payload.cycle_name = suiteName;
      } else if (tool === 'testrail') {
        endpoint = '/test-management/export-testrail-job';
        payload.suite_name = suiteName;
      } else {
        throw new Error('Unsupported export tool');
      }

      const response = await apiClient.post(endpoint, payload);
      jobId = response.data.job_id;
      return jobId;
    };

    const pollJob = async (id) => {
      while (!cancelRequested) {
        const res = await apiClient.get(`/test-management/export/job-status/${id}`);
        const status = res.data.status;
        if (status === 'completed') return res.data.result;
        if (status === 'error') {
          const err = new Error(res.data.error || 'Export failed');
          err.serverError = res.data.error || 'Export failed';
          throw err;
        }
        if (status === 'cancelled') throw new Error('export_cancelled');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      throw new Error('export_cancelled');
    };

    const promise = (async () => {
      const id = await startJob();
      return pollJob(id);
    })();

    const cancel = async () => {
      cancelRequested = true;
      if (jobId) {
        await apiClient.post(`/test-management/export/cancel/${jobId}`);
      }
    };

    return { promise, cancel };
  },
};

