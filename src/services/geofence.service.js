import api from './api'

export const geofenceService = {
  list: (branchId) => api.get('/attendance/geofences', { params: { branch_id: branchId } }),
  create: (data) => api.post('/attendance/geofences', data),
  update: (id, data) => api.put(`/attendance/geofences/${id}`, data),
  remove: (id) => api.delete(`/attendance/geofences/${id}`),
  updateSettings: (data) => api.put('/attendance/geofence-settings', data),
}
