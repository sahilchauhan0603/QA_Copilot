/**
 * Authentication API
 */
import apiClient from './client';

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
