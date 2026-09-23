import api from './api'

export const savingsPotService = {
  getPots: (params) => api.get('/savings-pots', { params }),
  getReminders: (params) => api.get('/savings-pots/reminders', { params }),
  getPotById: (id) => api.get(`/savings-pots/${id}`),
  createPot: (data) => api.post('/savings-pots', data),
  updatePot: (id, data) => api.put(`/savings-pots/${id}`, data),
  deletePot: (id) => api.delete(`/savings-pots/${id}`),
  deposit: (data) => api.post('/savings-pots/deposit', data),
  withdraw: (id, data) => api.post(`/savings-pots/${id}/withdraw`, data),
  getHistory: (id, params) => api.get(`/savings-pots/${id}/history`, { params }),
  updateDeposit: (id, data) => api.put(`/savings-pots/deposits/${id}`, data),
  deleteDeposit: (id) => api.delete(`/savings-pots/deposits/${id}`),
  updateWithdrawal: (id, data) => api.put(`/savings-pots/withdrawals/${id}`, data),
  deleteWithdrawal: (id) => api.delete(`/savings-pots/withdrawals/${id}`),
  // Person methods
  getPersons: (params) => api.get('/savings-pots/persons', { params }),
  createPerson: (data) => api.post('/savings-pots/persons', data),
  updatePerson: (id, data) => api.put(`/savings-pots/persons/${id}`, data),
  deletePerson: (id) => api.delete(`/savings-pots/persons/${id}`),
}

export const counterWithdrawalService = {
  getAll: (params) => api.get('/counter-withdrawals', { params }),
  getSummary: (params) => api.get('/counter-withdrawals/summary', { params }),
  create: (data) => api.post('/counter-withdrawals', data),
  update: (id, data) => api.put(`/counter-withdrawals/${id}`, data),
  delete: (id) => api.delete(`/counter-withdrawals/${id}`),
}
