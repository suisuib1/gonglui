import assert from 'node:assert/strict'
import test from 'node:test'
import { apiRequest, resolveApiUrl, resolveAssetUrl } from './apiClient.js'

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
