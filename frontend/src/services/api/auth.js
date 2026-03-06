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

  verifyEmail: async (token) => {
    const response = await apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    return response.data;
  },

  resendVerification: async (email) => {
    const response = await apiClient.post('/auth/resend-verification', { email });
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

  googleAuth: async (accessToken, username = null) => {
    const response = await apiClient.post('/auth/google', {
      access_token: accessToken,
      ...(username ? { username } : {}),
    });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  updateProfile: async ({ fullName, username } = {}) => {
    const body = {};
    if (fullName !== undefined) body.full_name = fullName;
    if (username !== undefined) body.username = username;
    const response = await apiClient.put('/auth/profile', body);
    return response.data;
  },

  uploadAvatar: async (avatarDataUrl) => {
    const response = await apiClient.post('/auth/avatar', { avatar_data_url: avatarDataUrl });
    return response.data;
  },
};
