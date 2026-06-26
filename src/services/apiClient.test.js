import assert from 'node:assert/strict'
import test from 'node:test'
import { apiRequest, resolveApiUrl, resolveAssetUrl } from './apiClient.js'
import { clearAuth, saveAuth } from '../utils/authStorage.js'

test('resolveApiUrl prefixes relative API paths with VITE_API_BASE_URL', () => {
  globalThis.__VITE_ENV__ = {
    VITE_API_BASE_URL: 'https://api.example.com/',
  }

  assert.equal(resolveApiUrl('/api/routes'), 'https://api.example.com/api/routes')
  assert.equal(resolveApiUrl('https://other.example.com/api/routes'), 'https://other.example.com/api/routes')
})

test('apiRequest normalizes upload image URLs returned by the API', async () => {
  globalThis.__VITE_ENV__ = {
    VITE_API_BASE_URL: 'https://api.example.com',
  }

  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://api.example.com/api/routes')
    return {
      ok: true,
      json: async () => ({
        code: 0,
        data: {
          imageUrl: '/uploads/place-1/a.webp',
          nested: [{ imageUrl: 'https://cdn.example.com/keep.webp' }],
        },
      }),
    }
  }

  try {
    const data = await apiRequest('/api/routes')
    assert.equal(data.imageUrl, 'https://api.example.com/uploads/place-1/a.webp')
    assert.equal(data.nested[0].imageUrl, 'https://cdn.example.com/keep.webp')
    assert.equal(resolveAssetUrl('/uploads/place-1/b.webp'), 'https://api.example.com/uploads/place-1/b.webp')
  } finally {
    globalThis.fetch = previousFetch
    delete globalThis.__VITE_ENV__
  }
})

test('apiRequest sends bearer token when auth exists', async () => {
  const previousFetch = globalThis.fetch
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = createLocalStorage()
  saveAuth({
    token: 'token-1',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: { id: 'user-1', email: 'user1@example.com' },
  })

  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer token-1')
    return {
      ok: true,
      json: async () => ({ code: 0, data: { ok: true } }),
    }
  }

  try {
    const data = await apiRequest('/api/routes')
    assert.equal(data.ok, true)
  } finally {
    clearAuth()
    globalThis.fetch = previousFetch
    restoreLocalStorage(previousLocalStorage)
  }
})

test('apiRequest clears auth and dispatches auth:unauthorized on 401', async () => {
  const previousFetch = globalThis.fetch
  const previousLocalStorage = globalThis.localStorage
  const previousDispatchEvent = globalThis.dispatchEvent
  const events = []
  globalThis.localStorage = createLocalStorage()
  globalThis.dispatchEvent = (event) => {
    events.push(event.type)
    return true
  }
  saveAuth({
    token: 'expired-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: { id: 'user-1', email: 'user1@example.com' },
  })

  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({
      success: false,
      code: 'AUTH_INVALID_TOKEN',
      message: '登录已失效，请重新登录。',
      data: null,
    }),
  })

  try {
    await assert.rejects(() => apiRequest('/api/routes'), /登录已失效/)
    assert.equal(localStorage.getItem('gonglui-auth'), null)
    assert.deepEqual(events, ['auth:unauthorized'])
  } finally {
    globalThis.fetch = previousFetch
    globalThis.dispatchEvent = previousDispatchEvent
    restoreLocalStorage(previousLocalStorage)
  }
})

function createLocalStorage() {
  const values = new Map()
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

function restoreLocalStorage(previousLocalStorage) {
  if (previousLocalStorage === undefined) {
    delete globalThis.localStorage
  } else {
    globalThis.localStorage = previousLocalStorage
  }
}
