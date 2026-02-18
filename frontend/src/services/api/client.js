/**
 * Axios Client Configuration
 * Shared HTTP client with interceptors for auth and error handling
 */
import axios from 'axios';
import toast from 'react-hot-toast';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Flag to prevent multiple session expiry redirects
let isRedirecting = false;

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Don't send requests if we're already redirecting to login
    if (isRedirecting) {
      return Promise.reject(new axios.Cancel('Session expired, redirecting to login'));
    }
    
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    if (!axios.isCancel(error)) {
      toast.error('Request failed. Please try again.', { id: 'request-error' });
    }
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't handle cancelled requests
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }
    
    const isLoginEndpoint = error.config?.url?.includes('/auth/login');
    const isViewCredentials = error.config?.url?.includes('/view-credentials');
    const errorMsg = error.response?.data?.error || '';
    
    // Skip toast for configuration errors - handled by components with custom toast
    const isConfigError = errorMsg.includes('not configured');

    if (error.response?.status === 401) {
      if (isLoginEndpoint || isViewCredentials) {
        toast.error(errorMsg || 'Invalid credentials', { id: 'auth-error' });
      } else if (!isRedirecting) {
        // Session expired - handle once
        isRedirecting = true;
        localStorage.removeItem('auth_token');
        toast.error('Session expired. Please login again.', { 
          id: 'session-expired',
          duration: 4000
        });
        
        // Redirect immediately to login page
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }
    } else if (error.response?.status === 403) {
      toast.error('Access denied. You don\'t have permission.', { id: 'access-denied' });
    } else if (error.response?.status === 404) {
      toast.error('Resource not found.', { id: 'not-found' });
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.', { id: 'server-error' });
    } else if (error.response?.data?.error && !isConfigError) {
      toast.error(error.response.data.error, { id: 'api-error' });
    } else if (error.message === 'Network Error') {
      toast.error('Network error. Please check your connection.', { id: 'network-error' });
    } else if (!isConfigError) {
      toast.error('Something went wrong. Please try again.', { id: 'generic-error' });
    }
    return Promise.reject(error);
  }
);

export default apiClient;
