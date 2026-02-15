/**
 * API Services - Barrel Export
 * Central import point for all API modules
 */
export { default as apiClient } from './client';
export { API_BASE_URL } from './client';
export { authAPI } from './auth';
export { workspaceAPI } from './workspace';
export { teamAPI } from './teams';
export { integrationAPI } from './integrations';
export { testManagementAPI } from './testManagement';
export { testGenAPI } from './testGeneration';

// Default export for backward compatibility (apiClient)
export { default } from './client';
