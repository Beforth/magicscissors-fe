import api from './api'

export const payrollService = {
  getWages: (branchId) => api.get('/payroll/wages', { params: { branch_id: branchId } }),
  setWage: (employeeId, data) => api.put(`/payroll/wages/${employeeId}`, data),
  getSettings: () => api.get('/payroll/settings'),
  setSettings: (data) => api.put('/payroll/settings', data),
  getServiceTimeRules: () => api.get('/payroll/service-time/rules'),
  setServiceTimeRules: (data) => api.put('/payroll/service-time/rules', data),
  getServiceTimeReport: (branchId, month) =>
    api.get('/payroll/service-time/report', { params: { branch_id: branchId, month } }),
  getReport: (branchId, month) => api.get('/payroll/report', { params: { branch_id: branchId, month } }),
}
