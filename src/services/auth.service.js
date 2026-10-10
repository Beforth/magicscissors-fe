import api from './api'

export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),

  logout: () => api.post('/auth/logout'),

  me: () => api.get('/auth/me'),

  refreshToken: (refreshToken) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),

  onboarding: () => api.get('/auth/onboarding'),

  setupStatus: () => api.get('/auth/setup-status'),

  setup: (data) => api.post('/auth/setup', data),

  changePassword: (data) => api.post('/auth/change-password', data),
}
