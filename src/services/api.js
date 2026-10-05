import axios from 'axios'

// Use env if set; otherwise same origin (so on server it calls the domain, not localhost)
function getApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL
  if (typeof window !== 'undefined') return window.location.origin + '/api/v1'
  return 'http://localhost:5001/api/v1'
}

const baseURL = getApiBaseUrl()

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

/** Single in-flight refresh so parallel 401s don't race or spam /auth/refresh. */
let refreshPromise = null

function clearAuthStorage() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
}

function getStoredToken(key) {
  const value = localStorage.getItem(key)
  if (!value || value === 'undefined' || value === 'null') return null
  return value
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refreshToken = getStoredToken('refreshToken')
    if (!refreshToken) {
      throw new Error('No refresh token')
    }

    const response = await axios.post(`${baseURL}/auth/refresh`, {
      refresh_token: refreshToken,
    })

    const accessToken = response.data?.data?.access_token
    if (!accessToken) {
      throw new Error('Refresh response missing access_token')
    }

    localStorage.setItem('accessToken', accessToken)
    return accessToken
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

function redirectToLogin() {
  clearAuthStorage()
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - unwrap body + refresh expired access tokens
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config
    if (!originalRequest) {
      return Promise.reject(error)
    }

    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/logout')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true

      try {
        const accessToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        redirectToLogin()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export { baseURL, clearAuthStorage, getStoredToken, refreshAccessToken, redirectToLogin }
export default api
