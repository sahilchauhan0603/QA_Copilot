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
    let _resolve = null;
    let _reject = null;
    let _cancelled = false;
    let _pollController = null;

    const promise = new Promise((res, rej) => { _resolve = res; _reject = rej; });

    (async () => {
      try {
        let endpoint = '';
        let payload = { generation_id: generationId, ticket_id: ticketId };
        if (tool === 'xray') { endpoint = '/test-management/export-xray-job'; payload.suite_name = suiteName; }
        else if (tool === 'zephyr') { endpoint = '/test-management/export-zephyr-job'; payload.cycle_name = suiteName; }
        else if (tool === 'testrail') { endpoint = '/test-management/export-testrail-job'; payload.suite_name = suiteName; }
        else { if (_reject) _reject(new Error('Unsupported export tool')); return; }

        const response = await apiClient.post(endpoint, payload);
        jobId = response.data.job_id;

        if (_cancelled) {
          apiClient.post(`/test-management/export/cancel/${jobId}`).catch(() => {});
          if (_reject) { _reject(new Error('export_cancelled')); _reject = null; }
          return;
        }

        // Poll loop
        while (!_cancelled) {
          _pollController = new AbortController();
          let res;
          try {
            res = await apiClient.get(`/test-management/export/job-status/${jobId}`, {
              signal: _pollController.signal,
            });
          } catch (e) {
            if (_cancelled || e.code === 'ERR_CANCELED') return; // _reject already called by cancel()
            if (_reject) { _reject(e); _reject = null; }
            return;
          }
          const status = res.data.status;
          if (status === 'completed') { if (_resolve) _resolve(res.data.result); return; }
          if (status === 'error') {
            const err = new Error(res.data.error || 'Export failed');
            err.serverError = res.data.error || 'Export failed';
            if (_reject) { _reject(err); _reject = null; }
            return;
          }
          if (status === 'cancelled') { if (_reject) { _reject(new Error('export_cancelled')); _reject = null; } return; }
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (e) {
        if (_reject) { _reject(e); _reject = null; }
      }
    })();

    const cancel = async () => {
      _cancelled = true;
      if (_pollController) _pollController.abort();
      // Immediately unblock the awaiting caller
      if (_reject) { _reject(new Error('export_cancelled')); _reject = null; }
      if (jobId) apiClient.post(`/test-management/export/cancel/${jobId}`).catch(() => {});
    };

    return { promise, cancel };
  },
};

