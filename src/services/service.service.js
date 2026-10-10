import api from './api'

export const serviceService = {
  // Categories
  getCategories: (params) => api.get('/services/categories', { params }),

  createCategory: (data) => api.post('/services/categories', data),

  updateCategory: (id, data) => api.put(`/services/categories/${id}`, data),

  deleteCategory: (id) => api.delete(`/services/categories/${id}`),

  // Services
  getServices: (params) => api.get('/services', { params }),

  getServiceById: (id) => api.get(`/services/${id}`),

  createService: (data) => api.post('/services', data),

  updateService: (id, data) => api.put(`/services/${id}`, data),

  replaceServiceRecipes: (id, recipes) => api.put(`/services/${id}/recipes`, { recipes }),

  // Package Categories
  getPackageCategories: (params) => api.get('/packages/categories', { params }),

  createPackageCategory: (data) => api.post('/packages/categories', data),

  updatePackageCategory: (id, data) => api.put(`/packages/categories/${id}`, data),

  deletePackageCategory: (id) => api.delete(`/packages/categories/${id}`),

  // Packages
  getPackages: (params) => api.get('/packages', { params }),

  getPackageById: (id) => api.get(`/packages/${id}`),

  createPackage: (data) => api.post('/packages', data),

  updatePackage: (id, data) => api.put(`/packages/${id}`, data),

  previewPackageDistribution: (data) => api.post('/packages/preview-distribution', data),
}
