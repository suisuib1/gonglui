import { clearAuth, getToken } from '../utils/authStorage.js'

export function getApiBaseUrl() {
  const env = globalThis.__VITE_ENV__ || import.meta.env || {}
  return String(env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
}

export function resolveApiUrl(path) {
  const url = String(path || '')
  if (/^https?:\/\//i.test(url)) return url

  const baseUrl = getApiBaseUrl()
  if (!baseUrl) return url

  return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`
}

export function resolveAssetUrl(path) {
  const url = String(path || '')
  if (!url || /^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url
  }

  const baseUrl = getApiBaseUrl()
  if (!baseUrl || !url.startsWith('/uploads/')) return url

  return `${baseUrl}${url}`
}

export async function apiRequest(path, options = {}) {
  const { skipAuth, ...fetchOptions } = options
  const headers = buildRequestHeaders(options, { skipAuth })
  const response = await fetch(resolveApiUrl(path), {
    ...fetchOptions,
    headers,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.code !== 0) {
    if (response.status === 401) {
      clearAuth()
      dispatchUnauthorized()
    }
    throw new Error(payload?.message || `Request failed: ${response.status}`)
  }

  return normalizeApiData(payload.data)
}

function buildRequestHeaders(options, authOptions) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  }
  const token = authOptions.skipAuth ? '' : getToken()

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

function dispatchUnauthorized() {
  if (typeof globalThis.dispatchEvent !== 'function') return
  globalThis.dispatchEvent(new Event('auth:unauthorized'))
}

function normalizeApiData(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeApiData)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === 'imageUrl' && typeof item === 'string' ? resolveAssetUrl(item) : normalizeApiData(item),
    ]),
  )
}
