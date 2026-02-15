/**
 * Test Management Export API
 * Xray, Zephyr Scale, TestRail export operations
 */
import apiClient from './client';

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
