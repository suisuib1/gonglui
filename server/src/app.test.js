import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from './app.js'

const app = await createApp()

test('GET /api/health returns unified ok response without sensitive data', async () => {
  const server = app.listen(0)

  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/api/health`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.code, 0)
    assert.equal(payload.message, 'ok')
    assert.equal(payload.data.status, 'ok')
    assert.match(payload.data.time, /^\d{4}-\d{2}-\d{2}T/)
    assert.equal('DATABASE_URL' in payload.data, false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('POST /api/routes/plan returns polyline plan without amap web key', async () => {
  const server = app.listen(0)

  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/api/routes/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        travelMode: 'polyline',
        points: [
          { longitude: 120.1, latitude: 30.1 },
          { longitude: 120.2, latitude: 30.2 },
        ],
      }),
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.code, 0)
    assert.equal(payload.data.travelMode, 'polyline')
    assert.deepEqual(payload.data.segments[0].path, [
      [120.1, 30.1],
      [120.2, 30.2],
    ])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('POST /api/routes/optimize returns optimized order without amap web key for polyline', async () => {
  const server = app.listen(0)

  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/api/routes/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        travelMode: 'polyline',
        points: [
          { name: 'A', longitude: 120, latitude: 30 },
          { name: 'B', longitude: 120.2, latitude: 30 },
          { name: 'C', longitude: 120.05, latitude: 30 },
        ],
      }),
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.code, 0)
    assert.equal(payload.data.optimizedOrder[0], 0)
    assert.deepEqual([...payload.data.optimizedOrder].sort((a, b) => a - b), [0, 1, 2])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('CORS allows configured origins and credentials', async () => {
  const previousOrigin = process.env.CORS_ORIGIN
  process.env.CORS_ORIGIN = 'https://gonglui.pages.dev, https://www.example.com'
  const corsApp = await createApp()
  const server = corsApp.listen(0)

  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: {
        Origin: 'https://gonglui.pages.dev',
      },
    })

    assert.equal(response.headers.get('access-control-allow-origin'), 'https://gonglui.pages.dev')
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousOrigin === undefined) {
      delete process.env.CORS_ORIGIN
    } else {
      process.env.CORS_ORIGIN = previousOrigin
    }
  }
})

test('CORS allows the Cloudflare Pages origin by default in production', async () => {
  const previousOrigin = process.env.CORS_ORIGIN
  const previousNodeEnv = process.env.NODE_ENV
  delete process.env.CORS_ORIGIN
  process.env.NODE_ENV = 'production'
  const corsApp = await createApp()
  const server = corsApp.listen(0)

  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: {
        Origin: 'https://gonglui-qd.pages.dev',
      },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://gonglui-qd.pages.dev')
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousOrigin === undefined) {
      delete process.env.CORS_ORIGIN
    } else {
      process.env.CORS_ORIGIN = previousOrigin
    }
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = previousNodeEnv
    }
  }
})

test('CORS handles OPTIONS preflight for route planning', async () => {
  const previousOrigin = process.env.CORS_ORIGIN
  const previousNodeEnv = process.env.NODE_ENV
  delete process.env.CORS_ORIGIN
  process.env.NODE_ENV = 'production'
  const corsApp = await createApp()
  const server = corsApp.listen(0)

  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/api/routes/plan`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://gonglui-qd.pages.dev',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    })

    assert.equal(response.status, 204)
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://gonglui-qd.pages.dev')
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousOrigin === undefined) {
      delete process.env.CORS_ORIGIN
    } else {
      process.env.CORS_ORIGIN = previousOrigin
    }
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = previousNodeEnv
    }
  }
})
