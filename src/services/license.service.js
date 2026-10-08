import api from './api'

export const licenseService = {
  getStatus: () => api.get('/license'),
  activate: (license) => api.post('/license/activate', { license }),
}
