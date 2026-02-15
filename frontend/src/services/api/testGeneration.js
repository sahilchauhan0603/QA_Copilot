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
   * @returns {Promise<Object>} - Final generation result
   */
  generate: async (ticketData, onProgress = null) => {
    const response = await apiClient.post('/test-generation/generate', ticketData);
    const { job_id } = response.data;

    if (!job_id) {
      return response.data;
    }

    return new Promise((resolve, reject) => {
      const baseUrl = API_BASE_URL.replace(/\/api$/, '');
      const eventSource = new EventSource(`${baseUrl}/api/test-generation/progress/${job_id}`);
      let timeoutId = setTimeout(() => {
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
   * @returns {Promise<Object>} - Refined generation result
   */
  refine: async (generationId, refinementType, options = {}, onProgress = null) => {
    const requestBody = {
      generation_id: generationId,
      refinement_type: refinementType,
      ...options,
    };

    const response = await apiClient.post('/test-generation/refine', requestBody);

    if (refinementType === 'regenerate' && response.data.job_id) {
      const { job_id } = response.data;

      return new Promise((resolve, reject) => {
        const baseUrl = API_BASE_URL.replace(/\/api$/, '');
        const eventSource = new EventSource(`${baseUrl}/api/test-generation/progress/${job_id}`);
        let timeoutId = setTimeout(() => {
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
    }

    return response.data;
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
