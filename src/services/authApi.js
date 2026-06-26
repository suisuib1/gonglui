import { apiRequest } from './apiClient'

export function login(credentials) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  })
}

export function getCurrentUser() {
  return apiRequest('/api/auth/me')
}
