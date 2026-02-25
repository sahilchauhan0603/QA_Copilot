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
    
    const promise = (async () => {
      const response = await apiClient.post('/test-generation/generate', ticketData);
      jobId = response.data.job_id;

      if (!jobId) {
        return response.data;
      }

      return new Promise((resolve, reject) => {
        const baseUrl = API_BASE_URL.replace(/\/api$/, '');
        eventSource = new EventSource(`${baseUrl}/api/test-generation/progress/${jobId}`);
        timeoutId = setTimeout(() => {
          eventSource.close();
          reject(new Error('Generation timed out after 5 minutes'));
        }, 300000);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'step' && onProgress) {
              onProgress(data);
            } else if (data.type === 'complete') {
              clearTimeout(timeoutId);
              eventSource.close();
              if (onProgress) {
                onProgress({ type: 'complete', progress: 100, label: 'Complete!' });
              }
              resolve(data.result);
            } else if (data.type === 'cancelled') {
              clearTimeout(timeoutId);
              eventSource.close();
              reject(new Error(data.message || 'Generation cancelled'));
            } else if (data.type === 'error') {
              clearTimeout(timeoutId);
              eventSource.close();
              reject(new Error(data.message || 'Generation failed'));
            } else if (data.type === 'done') {
              clearTimeout(timeoutId);
              eventSource.close();
            }
          } catch (e) {
            // Ignore parse errors for SSE heartbeats
          }
        };

        eventSource.onerror = () => {
          clearTimeout(timeoutId);
          eventSource.close();
        };
      });
    })();
    
    const cancel = async () => {
      if (eventSource) {
        eventSource.close();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (jobId) {
        try {
          await apiClient.post(`/test-generation/cancel/${jobId}`);
        } catch (e) {
          // Ignore cancel errors
        }
      }
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
      // Non-regenerate refinement runs as async job with polling + server-side cancel
      let jobId = null;
      let cancelRequested = false;

      const pollJob = async (id) => {
        while (!cancelRequested) {
          const res = await apiClient.get(`/test-generation/refine/job-status/${id}`);
          const status = res.data.status;
          if (status === 'completed') return res.data.result;
          if (status === 'error') throw new Error(res.data.error || 'Refinement failed');
          if (status === 'cancelled') throw new Error('refine_cancelled');
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        throw new Error('refine_cancelled');
      };

      const promise = (async () => {
        const response = await apiClient.post('/test-generation/refine', requestBody);
        if (!response.data.job_id) {
          return response.data;
        }
        jobId = response.data.job_id;

        if (cancelRequested) {
          try {
            await apiClient.post(`/test-generation/refine/cancel/${jobId}`);
          } catch (e) {
            // Ignore cancel errors
          }
          throw new Error('refine_cancelled');
        }

        return pollJob(jobId);
      })();

      const cancel = async () => {
        cancelRequested = true;
        if (jobId) {
          try {
            await apiClient.post(`/test-generation/refine/cancel/${jobId}`);
          } catch (e) {
            // Ignore cancel errors
          }
        }
      };

      return { promise, cancel, get jobId() { return jobId; } };
    }

    // Regenerate uses SSE, so return { promise, cancel, jobId }
    let eventSource = null;
    let timeoutId = null;
    let jobId = null;
    
    const promise = (async () => {
      const response = await apiClient.post('/test-generation/refine', requestBody);
      jobId = response.data.job_id;

      if (!jobId) {
        return response.data;
      }

      return new Promise((resolve, reject) => {
        const baseUrl = API_BASE_URL.replace(/\/api$/, '');
        eventSource = new EventSource(`${baseUrl}/api/test-generation/progress/${jobId}`);
        timeoutId = setTimeout(() => {
          eventSource.close();
          reject(new Error('Regeneration timed out after 5 minutes'));
        }, 300000);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'step' && onProgress) {
              onProgress(data);
            } else if (data.type === 'complete') {
              clearTimeout(timeoutId);
              eventSource.close();
              if (onProgress) {
                onProgress({ type: 'complete', progress: 100, label: 'Complete!' });
              }
              resolve(data.result);
            } else if (data.type === 'cancelled') {
              clearTimeout(timeoutId);
              eventSource.close();
              reject(new Error(data.message || 'Regeneration cancelled'));
            } else if (data.type === 'error') {
              clearTimeout(timeoutId);
              eventSource.close();
              reject(new Error(data.message || 'Regeneration failed'));
            } else if (data.type === 'done') {
              clearTimeout(timeoutId);
              eventSource.close();
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        eventSource.onerror = () => {
          clearTimeout(timeoutId);
          eventSource.close();
        };
      });
    })();
    
    const cancel = async () => {
      if (eventSource) {
        eventSource.close();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (jobId) {
        try {
          await apiClient.post(`/test-generation/cancel/${jobId}`);
        } catch (e) {
          // Ignore cancel errors
        }
      }
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
