import api from './api'

export const payrollService = {
  getWages: (branchId) => api.get('/payroll/wages', { params: { branch_id: branchId } }),
  setWage: (employeeId, data) => api.put(`/payroll/wages/${employeeId}`, data),
  getSettings: () => api.get('/payroll/settings'),
  setSettings: (data) => api.put('/payroll/settings', data),
  getReport: (branchId, month) => api.get('/payroll/report', { params: { branch_id: branchId, month } }),
}
