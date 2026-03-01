/**
 * Test Generation API
 * Generate, refine, manage test case generations with SSE progress
 */
import apiClient from './client';
import { API_BASE_URL } from './client';

export const testGenAPI = {
  /** 
   * Generate test cases with real-time progress via SSE 
   * @param {Object} ticketData - Ticket information
   * @param {Function} onProgress - Callback for progress updates
   * @returns {Object} - { promise, cancel, jobId } - Promise for result, cancel function, and job ID
   */
  generate: (ticketData, onProgress = null) => {
    let eventSource = null;
    let timeoutId = null;
    let jobId = null;
    let _reject = null;    // shared reference so cancel() can immediately reject
    let _cancelled = false;

    // Wrap in an outer Promise so we can expose _reject to cancel()
    let _resolve;
    const promise = new Promise((res, rej) => { _resolve = res; _reject = rej; });

    (async () => {
      try {
        const response = await apiClient.post('/test-generation/generate', ticketData);
        jobId = response.data.job_id;

        if (!jobId) { _resolve(response.data); return; }

        // Already cancelled during the initial POST
        if (_cancelled) {
          apiClient.post(`/test-generation/cancel/${jobId}`).catch(() => {});
          _reject(new Error('Generation cancelled'));
          return;
        }

        const baseUrl = API_BASE_URL.replace(/\/api$/, '');
        eventSource = new EventSource(`${baseUrl}/api/test-generation/progress/${jobId}`);
        timeoutId = setTimeout(() => {
          eventSource.close();
          if (_reject) { _reject(new Error('Generation timed out after 5 minutes')); _reject = null; }
        }, 300000);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'step' && onProgress) {
              onProgress(data);
            } else if (data.type === 'complete') {
              clearTimeout(timeoutId);
              eventSource.close();
              if (onProgress) onProgress({ type: 'complete', progress: 100, label: 'Complete!' });
              if (_resolve) { _resolve(data.result); _resolve = null; }
            } else if (data.type === 'cancelled') {
              clearTimeout(timeoutId);
              eventSource.close();
              if (_reject) { _reject(new Error(data.message || 'Generation cancelled')); _reject = null; }
            } else if (data.type === 'error') {
              clearTimeout(timeoutId);
              eventSource.close();
              if (_reject) { _reject(new Error(data.message || 'Generation failed')); _reject = null; }
            } else if (data.type === 'done') {
              clearTimeout(timeoutId);
              eventSource.close();
            }
          } catch (e) { /* ignore SSE parse errors */ }
        };

        eventSource.onerror = () => {
          clearTimeout(timeoutId);
          eventSource.close();
          // Only surface as error if it wasn't a deliberate cancel
          if (!_cancelled && _reject) {
            _reject(new Error('Connection lost during generation'));
            _reject = null;
          }
        };
      } catch (e) {
        if (_reject) { _reject(e); _reject = null; }
      }
    })();

    const cancel = async () => {
      _cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (eventSource) { eventSource.close(); eventSource = null; }
      // Immediately unblock await promise — don't wait for a backend roundtrip
      if (_reject) { _reject(new Error('Generation cancelled')); _reject = null; }
      // Notify backend in background (fire-and-forget)
      if (jobId) apiClient.post(`/test-generation/cancel/${jobId}`).catch(() => {});
    };

    return { promise, cancel, get jobId() { return jobId; } };
  },

  /** AI-generate description and acceptance criteria from title */
  aiDescribe: async (title, ticketType, priority) => {
    const response = await apiClient.post('/test-generation/ai-describe', {
      title,
      ticket_type: ticketType,
      priority,
    });
    return response.data;
  },

  /** 
   * Refine existing test cases
   * @param {string} generationId - ID of the generation to refine
   * @param {string} refinementType - minimize, focus, edge_cases, coverage, simplify, regenerate
   * @param {Object} options - Additional options like focus_area
   * @param {Function} onProgress - Progress callback (for regenerate only)
   * @returns {Object|Promise} - For regenerate: { promise, cancel, jobId }, otherwise Promise
   */
  refine: (generationId, refinementType, options = {}, onProgress = null) => {
    const requestBody = {
      generation_id: generationId,
      refinement_type: refinementType,
      ...options,
    };

    if (refinementType !== 'regenerate') {
      // Non-regenerate refinement: async job with polling + server-side cancel
      let jobId = null;
      let _resolve = null;
      let _reject = null;
      let _cancelled = false;
      let _pollController = null; // AbortController for in-flight poll requests

      const promise = new Promise((res, rej) => { _resolve = res; _reject = rej; });

      (async () => {
        try {
          const response = await apiClient.post('/test-generation/refine', requestBody);
          if (!response.data.job_id) { if (_resolve) _resolve(response.data); return; }
          jobId = response.data.job_id;

          if (_cancelled) {
            apiClient.post(`/test-generation/refine/cancel/${jobId}`).catch(() => {});
            if (_reject) { _reject(new Error('refine_cancelled')); _reject = null; }
            return;
          }

          // Poll loop
          while (!_cancelled) {
            _pollController = new AbortController();
            let res;
            try {
              res = await apiClient.get(`/test-generation/refine/job-status/${jobId}`, {
                signal: _pollController.signal,
              });
            } catch (e) {
              // Aborted by cancel() or network error
              if (_cancelled || e.code === 'ERR_CANCELED') return; // _reject already called
              if (_reject) { _reject(e); _reject = null; }
              return;
            }
            const status = res.data.status;
            if (status === 'completed') { if (_resolve) _resolve(res.data.result); return; }
            if (status === 'error') { if (_reject) { _reject(new Error(res.data.error || 'Refinement failed')); _reject = null; } return; }
            if (status === 'cancelled') { if (_reject) { _reject(new Error('refine_cancelled')); _reject = null; } return; }
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
        if (_reject) { _reject(new Error('refine_cancelled')); _reject = null; }
        if (jobId) apiClient.post(`/test-generation/refine/cancel/${jobId}`).catch(() => {});
      };

      return { promise, cancel, get jobId() { return jobId; } };
    }

    // Regenerate uses SSE — same pattern as generate()
    let eventSource = null;
    let timeoutId = null;
    let jobId = null;
    let _resolve = null;
    let _reject = null;
    let _cancelled = false;

    const promise = new Promise((res, rej) => { _resolve = res; _reject = rej; });

    (async () => {
      try {
        const response = await apiClient.post('/test-generation/refine', requestBody);
        jobId = response.data.job_id;
        if (!jobId) { if (_resolve) _resolve(response.data); return; }

        if (_cancelled) {
          apiClient.post(`/test-generation/cancel/${jobId}`).catch(() => {});
          if (_reject) { _reject(new Error('Regeneration cancelled')); _reject = null; }
          return;
        }

        const baseUrl = API_BASE_URL.replace(/\/api$/, '');
        eventSource = new EventSource(`${baseUrl}/api/test-generation/progress/${jobId}`);
        timeoutId = setTimeout(() => {
          eventSource.close();
          if (_reject) { _reject(new Error('Regeneration timed out after 5 minutes')); _reject = null; }
        }, 300000);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'step' && onProgress) {
              onProgress(data);
            } else if (data.type === 'complete') {
              clearTimeout(timeoutId);
              eventSource.close();
              if (onProgress) onProgress({ type: 'complete', progress: 100, label: 'Complete!' });
              if (_resolve) { _resolve(data.result); _resolve = null; }
            } else if (data.type === 'cancelled') {
              clearTimeout(timeoutId);
              eventSource.close();
              if (_reject) { _reject(new Error(data.message || 'Regeneration cancelled')); _reject = null; }
            } else if (data.type === 'error') {
              clearTimeout(timeoutId);
              eventSource.close();
              if (_reject) { _reject(new Error(data.message || 'Regeneration failed')); _reject = null; }
            } else if (data.type === 'done') {
              clearTimeout(timeoutId);
              eventSource.close();
            }
          } catch (e) { /* ignore SSE parse errors */ }
        };

        eventSource.onerror = () => {
          clearTimeout(timeoutId);
          eventSource.close();
          if (!_cancelled && _reject) { _reject(new Error('Connection lost during regeneration')); _reject = null; }
        };
      } catch (e) {
        if (_reject) { _reject(e); _reject = null; }
      }
    })();

    const cancel = async () => {
      _cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (eventSource) { eventSource.close(); eventSource = null; }
      if (_reject) { _reject(new Error('Regeneration cancelled')); _reject = null; }
      if (jobId) apiClient.post(`/test-generation/cancel/${jobId}`).catch(() => {});
    };

    return { promise, cancel, get jobId() { return jobId; } };
  },

  /** Get all generations */
  getGenerations: async (params = {}) => {
    const response = await apiClient.get('/test-generation/generations', { params });
    return response.data;
  },

  /** Get a specific generation */
  getGeneration: async (generationId) => {
    const response = await apiClient.get(`/test-generation/generations/${generationId}`);
    return response.data;
  },

  /** Delete a generation */
  deleteGeneration: async (generationId) => {
    const response = await apiClient.delete(`/test-generation/generations/${generationId}`);
    return response.data;
  },

  /** Get statistics */
  getStatistics: async () => {
    const response = await apiClient.get('/test-generation/statistics');
    return response.data;
  },

  /** Download Excel file */
  downloadExcel: async (generationId) => {
    const response = await apiClient.get(`/test-generation/download/${generationId}`, {
      responseType: 'blob',
    });
    return response;
  },
};
