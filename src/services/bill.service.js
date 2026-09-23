import api from './api'

export const billService = {
  getBills: (params) => api.get('/bills', { params }),

  getBillById: (id) => api.get(`/bills/${id}`),

  createBill: (data) => api.post('/bills', data),

  updateBill: (id, data) => api.put(`/bills/${id}`, data),

  completeBill: (id, data) => api.post(`/bills/${id}/complete`, data),

  cancelBill: (id) => api.delete(`/bills/${id}`),

  getPendingServices: (params) => api.get('/bills/pending-services', { params }),

  completeBillItem: (billId, itemId, data) => api.post(`/bills/${billId}/items/${itemId}/complete`, data),

  getConsumptionPreview: (billId, data) => api.post(`/bills/${billId}/consumption-preview`, data),

  getEmployeeStatus: (params) => api.get('/bills/employee-status', { params }),

  assignEmployeeFromQueue: (billId, itemId, data = {}) => api.post(`/bills/${billId}/items/${itemId}/assign-employee`, data),

  unassignEmployee: (billId, itemId, employeeId) => api.delete(`/bills/${billId}/items/${itemId}/employees/${employeeId}`),
}
