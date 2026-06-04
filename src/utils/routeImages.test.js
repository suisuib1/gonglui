import test from 'node:test'
import assert from 'node:assert/strict'
import { extractClipboardImageFiles, validateImageFile } from './routeImages.js'

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

test('extracts image files from clipboard items in order', () => {
  const png = { name: 'screen.png', type: 'image/png' }
  const jpeg = { name: 'photo.jpg', type: 'image/jpeg' }
  const result = extractClipboardImageFiles([
    { type: 'text/plain', getAsFile: () => ({ name: 'note.txt', type: 'text/plain' }) },
    { type: 'image/png', getAsFile: () => png },
    { type: 'image/jpeg', getAsFile: () => jpeg },
  ])

  assert.deepEqual(result, [png, jpeg])
})

test('returns an empty list when clipboard has no image files', () => {
  const result = extractClipboardImageFiles([
    { type: 'text/plain', getAsFile: () => ({ name: 'note.txt', type: 'text/plain' }) },
  ])

  assert.deepEqual(result, [])
})
