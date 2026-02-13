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
    // Don't redirect on login endpoint 401 (wrong credentials)
    const isLoginEndpoint = error.config?.url?.includes('/auth/login');
    
    if (error.response?.status === 401) {
      if (isLoginEndpoint) {
        // Show specific login error
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

export default apiClient;
