/**
 * Authentication Store
 * Global state management for authentication and workspace context using Zustand
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import toast from 'react-hot-toast';
import { authAPI, workspaceAPI } from '../services/api';

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
          
          // Save token to localStorage
          localStorage.setItem('auth_token', data.token);
          
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          // Fetch workspaces after signup
          await get().fetchWorkspaces();
          
          toast.success(`Account created! Welcome, ${data.user.username}!`);
          return { success: true };
        } catch (error) {
          // Error toast handled by axios interceptor
          const errorMessage = error.response?.data?.error || 'Signup failed';
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
          toast.success(`Switched to ${workspaceName}`);
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
        } catch (error) {
          console.error('Get current user error:', error);
          // Clear auth state if token is invalid
          get().logout();
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
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
