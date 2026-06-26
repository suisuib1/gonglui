import assert from 'node:assert/strict'
import test from 'node:test'
import { clearAuth, getToken, getUser, isLoggedIn, saveAuth } from './authStorage.js'

test('stores and reads token, user, and expiration from localStorage', () => {
  const store = createLocalStorage()
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = store

  try {
    saveAuth({
      token: 'token-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: 'user-1',
        email: 'user1@example.com',
        displayName: 'User One',
        role: 'user',
        status: 'active',
      },
    })

    assert.equal(getToken(), 'token-1')
    assert.equal(getUser().email, 'user1@example.com')
    assert.equal(isLoggedIn(), true)

    clearAuth()
    assert.equal(getToken(), '')
    assert.equal(getUser(), null)
    assert.equal(isLoggedIn(), false)
  } finally {
    restoreLocalStorage(previousLocalStorage)
  }
})

test('treats expired auth state as logged out', () => {
  const store = createLocalStorage()
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = store

  try {
    saveAuth({
      token: 'expired-token',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      user: { id: 'user-1', email: 'user1@example.com' },
    })

    assert.equal(isLoggedIn(), false)
    assert.equal(getToken(), '')
  } finally {
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
