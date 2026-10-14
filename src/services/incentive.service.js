import api from './api'

export const incentiveService = {
  listRules: () => api.get('/incentive-rules'),
  createRule: (data) => api.post('/incentive-rules', data),
  updateRule: (id, data) => api.put(`/incentive-rules/${id}`, data),
  deleteRule: (id) => api.delete(`/incentive-rules/${id}`),
  getSettings: () => api.get('/incentive-rules/settings'),
  setSettings: (data) => api.put('/incentive-rules/settings', data),
  getReport: (branchId, month) => api.get('/incentives/report', { params: { branch_id: branchId, month } }),
}
