/**
 * Authentication Store
 * Global state management for authentication and workspace context using Zustand
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import toast from 'react-hot-toast';
import { authAPI, workspaceAPI } from '../services/api/index';

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      workspaces: [],
      activeWorkspace: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),

      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authAPI.login(username, password);
          
          // Save token to localStorage
          localStorage.setItem('auth_token', data.token);
          
          set({
            user: data.user,
            token: data.token,
            workspaces: data.workspaces.workspaces || [],
            activeWorkspace: data.workspaces.active_workspace,
            isAuthenticated: true,
            isLoading: false,
          });
          
          toast.success(`Welcome back, ${data.user.username}!`);
          return { success: true };
        } catch (error) {
          const errorMessage = error.response?.data?.error || 'Login failed';
          set({ error: errorMessage, isLoading: false });
          // Error toast handled by axios interceptor
          return { success: false, error: errorMessage };
        }
      },

      signup: async (email, username, password, fullName) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authAPI.signup(email, username, password, fullName);

          set({ isLoading: false });
          toast.success(data.message || 'Account created. Check your email to verify your account.');
          return { success: true, emailSent: data.email_sent !== false };
        } catch (error) {
          // Error toast handled by axios interceptor
          const errorMessage = error.response?.data?.error || 'Signup failed';
          set({ error: errorMessage, isLoading: false });
          return { success: false, error: errorMessage };
        }
      },

      /**
       * Complete sign-in after Google OAuth.
       * Pass the Supabase access_token. If the backend returns needs_username=true,
       * this returns { needsUsername: true, email, fullName, oauthSub } so the
       * caller can prompt for a username, then call googleLogin again with it.
       */
      googleLogin: async (accessToken, username = null) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authAPI.googleAuth(accessToken, username);

          if (data.needs_username) {
            set({ isLoading: false });
            return {
              success: false,
              needsUsername: true,
              email: data.email,
              fullName: data.full_name,
              oauthSub: data.oauth_sub,
            };
          }

          localStorage.setItem('auth_token', data.token);
          set({
            user: data.user,
            token: data.token,
            workspaces: data.workspaces?.workspaces || [],
            activeWorkspace: data.workspaces?.active_workspace,
            isAuthenticated: true,
            isLoading: false,
          });
          toast.success(`Welcome, ${data.user.username}!`);
          return { success: true };
        } catch (error) {
          const errorMessage = error.response?.data?.error || 'Google sign-in failed';
          set({ error: errorMessage, isLoading: false });
          return { success: false, error: errorMessage };
        }
      },

      logout: async () => {
        try {
          await authAPI.logout();
          toast.success('Logged out successfully');
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          localStorage.removeItem('auth_token');
          set({
            user: null,
            token: null,
            workspaces: [],
            activeWorkspace: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      fetchWorkspaces: async () => {
        try {
          const data = await workspaceAPI.getWorkspaces();
          set({
            workspaces: data.workspaces || [],
            activeWorkspace: data.active_workspace,
          });
        } catch (error) {
          console.error('Fetch workspaces error:', error);
        }
      },

      switchWorkspace: async (teamId = null) => {
        set({ isLoading: true, error: null });
        try {
          await workspaceAPI.switchWorkspace(teamId);
          set({
           activeWorkspace: teamId,
            isLoading: false,
          });
          const workspaceName = teamId === null ? 'Personal Workspace' : 'Team Workspace';
          toast.success(`Switched to ${workspaceName}`, { duration: 2500 });
          return { success: true };
        } catch (error) {
          const errorMessage = error.response?.data?.error || 'Failed to switch workspace';
          set({ error: errorMessage, isLoading: false });
          // Error toast handled by axios interceptor
          return { success: false, error: errorMessage };
        }
      },

      getCurrentUser: async () => {
        try {
          const data = await authAPI.getCurrentUser();
          set({
            user: data.user,
            workspaces: data.workspaces.workspaces || [],
            activeWorkspace: data.workspaces.active_workspace,
            isAuthenticated: true,
          });
          return { success: true };
        } catch (error) {
          console.error('Get current user error:', error);
          // Clear auth state if token is invalid
          localStorage.removeItem('auth_token');
          set({
            user: null,
            token: null,
            workspaces: [],
            activeWorkspace: null,
            isAuthenticated: false,
            error: null,
          });
          return { success: false };
        }
      },
      
      // Initialize and validate session on app load
      initializeAuth: async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          // No token, ensure state is cleared
          set({
            user: null,
            token: null,
            workspaces: [],
            activeWorkspace: null,
            isAuthenticated: false,
            error: null,
          });
          return;
        }
        
        // Token exists, validate it
        const result = await get().getCurrentUser();
        if (!result.success) {
          // Token invalid, state already cleared by getCurrentUser
          console.log('Session invalid or expired');
        }
      },

      // Utility function to get active workspace details
      getActiveWorkspaceDetails: () => {
        const { activeWorkspace, workspaces } = get();
        if (activeWorkspace === null) {
          return { id: null, name: 'Personal Workspace', type: 'personal' };
        }
        return workspaces.find(w => w.id === activeWorkspace) || null;
      },

      updateProfile: async (fullName) => {
        try {
          const data = await authAPI.updateProfile(fullName);
          set((state) => ({ user: { ...state.user, ...data.user } }));
          toast.success('Name updated!');
          return { success: true };
        } catch (error) {
          const msg = error.response?.data?.error || 'Failed to update name';
          toast.error(msg);
          return { success: false, error: msg };
        }
      },

      uploadAvatar: async (avatarDataUrl) => {
        try {
          const data = await authAPI.uploadAvatar(avatarDataUrl);
          set((state) => ({ user: { ...state.user, ...data.user } }));
          toast.success('Profile picture updated!');
          return { success: true };
        } catch (error) {
          const msg = error.response?.data?.error || 'Failed to upload avatar';
          toast.error(msg);
          return { success: false, error: msg };
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist user data, not authentication state
        // Authentication will be validated on app initialization
        user: state.user,
      }),
    }
  )
);

export default useAuthStore;
