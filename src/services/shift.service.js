import api from './api'

export const shiftService = {
  getShifts: (params) => api.get('/shifts', { params }),

  getShiftById: (id) => api.get(`/shifts/${id}`),

  createShift: (data) => api.post('/shifts', data),

  updateShift: (id, data) => api.put(`/shifts/${id}`, data),

  toggleActive: (id) => api.patch(`/shifts/${id}/toggle-active`),

  getAssignments: (params) => api.get('/shifts/assignments', { params }),

  assignShift: (employeeId, shiftId, shiftDate) =>
    api.post('/shifts/assignments', {
      employee_id: employeeId,
      shift_id: shiftId,
      shift_date: shiftDate,
    }),

  removeAssignment: (id) => api.delete(`/shifts/assignments/${id}`),
}
