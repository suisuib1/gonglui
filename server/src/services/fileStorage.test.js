import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { getUploadRoot, resolvePlaceUploadDir } from './fileStorage.js'

test('resolves place upload directories inside the upload root', () => {
  const targetDir = resolvePlaceUploadDir('cmpwda2qh000boxz81uywgujj')

  assert.equal(targetDir, path.join(getUploadRoot(), 'cmpwda2qh000boxz81uywgujj'))
})

test('rejects invalid place ids before building upload paths', () => {
  assert.throws(() => resolvePlaceUploadDir('..'), /Invalid place id/)
  assert.throws(() => resolvePlaceUploadDir('place/with/slash'), /Invalid place id/)
})
