/**
 * API Client
 * Axios configuration and API service functions
 */
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // Don't set Content-Type globally - let axios set it automatically
  // only when there's request data (POST/PUT/PATCH)
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    toast.error('Request failed. Please try again.');
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on certain 401s (wrong credentials, not expired session)
    const isLoginEndpoint = error.config?.url?.includes('/auth/login');
    const isViewCredentials = error.config?.url?.includes('/view-credentials');
    
    if (error.response?.status === 401) {
      if (isLoginEndpoint || isViewCredentials) {
        // Show specific error without redirecting
        const errorMsg = error.response?.data?.error || 'Invalid credentials';
        toast.error(errorMsg);
      } else {
        // Token expired or invalid - clear auth state and redirect
        toast.error('Session expired. Please login again.');
        localStorage.removeItem('auth_token');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      }
    } else if (error.response?.status === 403) {
      toast.error('Access denied. You don\'t have permission.');
    } else if (error.response?.status === 404) {
      toast.error('Resource not found.');
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (error.response?.data?.error) {
      // Display specific error message from backend
      toast.error(error.response.data.error);
    } else if (error.message === 'Network Error') {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error('Something went wrong. Please try again.');
    }
    return Promise.reject(error);
  }
);

// ============================================
// Authentication API
// ============================================

export const authAPI = {
  signup: async (email, username, password, fullName) => {
    const response = await apiClient.post('/auth/signup', {
      email,
      username,
      password,
      full_name: fullName,
    });
    return response.data;
  },

  login: async (username, password) => {
    const response = await apiClient.post('/auth/login', {
      username,
      password,
    });
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};

// ============================================
// Workspace API
// ============================================

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

// ============================================
// Team Management API
// ============================================

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

// ============================================
// Integration API
// ============================================

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

// ============================================
// Test Management Export API
// ============================================

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
};

// ============================================
// Test Generation API
// ============================================

export const testGenAPI = {
  /** 
   * Generate test cases with real-time progress via SSE 
   * @param {Object} ticketData - Ticket information
   * @param {Function} onProgress - Callback for progress updates: ({agent, label, status, progress, detail})
   * @returns {Promise<Object>} - Final generation result
   */
  generate: async (ticketData, onProgress = null) => {
    // Step 1: Start generation (returns job_id)
    const response = await apiClient.post('/test-generation/generate', ticketData);
    const { job_id } = response.data;
    
    if (!job_id) {
      // Fallback: if no job_id returned, treat response as direct result
      return response.data;
    }
    
    // Step 2: Connect to SSE for progress tracking
    return new Promise((resolve, reject) => {
      const baseUrl = API_BASE_URL.replace(/\/api$/, '');
      const eventSource = new EventSource(`${baseUrl}/api/test-generation/progress/${job_id}`);
      let timeoutId = setTimeout(() => {
        eventSource.close();
        reject(new Error('Generation timed out after 5 minutes'));
      }, 300000); // 5 minute timeout
      
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
        // SSE connection errors are normal when the stream ends
        // Only reject if we haven't resolved yet
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
   * @param {string} refinementType - Type of refinement: minimize, focus, edge_cases, coverage, simplify, regenerate
   * @param {Object} options - Additional options like focus_area
   * @param {Function} onProgress - Progress callback (for regenerate only)
   * @returns {Promise<Object>} - Refined generation result
   */
  refine: async (generationId, refinementType, options = {}, onProgress = null) => {
    const requestBody = {
      generation_id: generationId,
      refinement_type: refinementType,
      ...options
    };
    
    const response = await apiClient.post('/test-generation/refine', requestBody);
    
    // If regenerating, handle SSE progress tracking
    if (refinementType === 'regenerate' && response.data.job_id) {
      const { job_id } = response.data;
      
      return new Promise((resolve, reject) => {
        const baseUrl = API_BASE_URL.replace(/\/api$/, '');
        const eventSource = new EventSource(`${baseUrl}/api/test-generation/progress/${job_id}`);
        let timeoutId = setTimeout(() => {
          eventSource.close();
          reject(new Error('Regeneration timed out after 5 minutes'));
        }, 300000); // 5 minute timeout
        
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
    
    // For other refinement types, return immediately
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

export default apiClient;
