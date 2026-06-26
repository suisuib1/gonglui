const AUTH_KEY = 'gonglui-auth'

export function saveAuth(auth) {
  const payload = {
    token: String(auth?.token || ''),
    expiresAt: auth?.expiresAt || '',
    user: auth?.user || null,
  }

  if (!payload.token || !payload.user) {
    clearAuth()
    return
  }

  getStorage()?.setItem(AUTH_KEY, JSON.stringify(payload))
}

export function getToken() {
  const auth = readAuth()
  if (!auth || isExpired(auth)) {
    clearAuth()
    return ''
  }

  return auth.token
}

export function getUser() {
  const auth = readAuth()
  if (!auth || isExpired(auth)) {
    clearAuth()
    return null
  }

  return auth.user || null
}

export function isLoggedIn() {
  return Boolean(getToken() && getUser())
}

export function clearAuth() {
  getStorage()?.removeItem(AUTH_KEY)
}

function readAuth() {
  try {
    const raw = getStorage()?.getItem(AUTH_KEY)
    if (!raw) return null
    const auth = JSON.parse(raw)
    if (!auth || typeof auth !== 'object') return null
    return auth
  } catch (error) {
    return null
  }
}

function getStorage() {
  return globalThis.localStorage
}

function isExpired(auth) {
  if (!auth.expiresAt) return false
  const expiresAt = new Date(auth.expiresAt).getTime()
  return Number.isFinite(expiresAt) && expiresAt <= Date.now()
}
