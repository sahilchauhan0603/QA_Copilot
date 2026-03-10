/**
 * Webhook API
 * Webhook subscription management for auto-regeneration on ticket updates
 */
import apiClient from './client';

export const webhookAPI = {
  /** Get all webhook subscriptions for the current workspace */
  getSubscriptions: async () => {
    const response = await apiClient.get('/webhooks/subscriptions');
    return response.data;
  },

  /** Create a webhook subscription */
  createSubscription: async (integrationtype, ticketId, ticketTitle, generationId) => {
    const response = await apiClient.post('/webhooks/subscriptions', {
      integration_type: integrationtype,
      ticket_id: ticketId,
      ticket_title: ticketTitle,
      generation_id: generationId,
    });
    return response.data;
  },

  /** Update subscription (toggle active) */
  updateSubscription: async (subId, data) => {
    const response = await apiClient.patch(`/webhooks/subscriptions/${subId}`, data);
    return response.data;
  },

  /** Delete a subscription */
  deleteSubscription: async (subId) => {
    const response = await apiClient.delete(`/webhooks/subscriptions/${subId}`);
    return response.data;
  },

  /** Get recent auto-regeneration activity (optional: since ISO timestamp) */
  getRecentActivity: async (since) => {
    const params = since ? { since } : {};
    const response = await apiClient.get('/webhooks/recent-activity', { params });
    return response.data;
  },
};
