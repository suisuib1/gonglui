import assert from 'node:assert/strict'
import test from 'node:test'
import { app } from './app.js'

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
