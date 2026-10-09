import api from './api'

export const attendanceService = {
  getTodayRoster: (params) => api.get('/attendance/today', { params }),
  ingestPunch: (data) => api.post('/attendance/punches', data),
  startBreak: (data) => api.post('/attendance/break/start', data),
  endBreak: (data) => api.post('/attendance/break/end', data),
  markLeave: (data) => api.post('/attendance/leave/mark', data),
  runAutoClose: (data) => api.post('/attendance/run-auto-close', data),
  getMonthlyAttendance: (params) => api.get('/attendance/monthly', { params }),
  updateTimes: (data) => api.post('/attendance/update-times', data),
  getPresenceCode: (branchId) => api.get('/attendance/presence-code', { params: { branch_id: branchId } }),
  getSelfConfig: () => api.get('/attendance/self/config'),
  selfPunch: (formData) =>
    api.post('/attendance/self/punch', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
}
