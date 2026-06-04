import test from 'node:test'
import assert from 'node:assert/strict'
import { validateImageFile } from './routeImages.js'

test('accepts image files up to 5MB', () => {
  const result = validateImageFile({
    type: 'image/jpeg',
    size: 5 * 1024 * 1024,
  })

  assert.deepEqual(result, { ok: true, message: '' })
})

test('rejects non-image files', () => {
  const result = validateImageFile({
    type: 'application/pdf',
    size: 1200,
  })

  assert.equal(result.ok, false)
  assert.match(result.message, /图片/)
})

test('rejects image files over 5MB', () => {
  const result = validateImageFile({
    type: 'image/png',
    size: 5 * 1024 * 1024 + 1,
  })

  assert.equal(result.ok, false)
  assert.match(result.message, /5MB/)
})
