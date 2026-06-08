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
  const response = await fetch(resolveApiUrl(path), {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.code !== 0) {
    throw new Error(payload?.message || `Request failed: ${response.status}`)
  }

  return normalizeApiData(payload.data)
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
