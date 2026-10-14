import api from './api'

export const incentiveService = {
  getSettings: () => api.get('/incentives/settings'),
  saveSettings: (data) => api.put('/incentives/settings', data),
  getReport: (branchId, month) => api.get('/incentives/report', { params: { branch_id: branchId, month } }),
}
