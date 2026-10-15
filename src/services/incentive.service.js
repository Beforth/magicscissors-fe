import api from './api'

export const incentiveService = {
  getSettings: () => api.get('/incentives/settings'),
  saveSettings: (data) => api.put('/incentives/settings', data),
  // branchId is optional: omitted (empty) = all branches together, so no branch_id param is sent.
  getReport: (branchId, month) => api.get('/incentives/report', { params: branchId ? { month, branch_id: branchId } : { month } }),
}
