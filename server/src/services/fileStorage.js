import fs from 'node:fs/promises'
import path from 'node:path'

const PLACE_ID_RE = /^c[a-z0-9]{20,}$/i

export function getUploadRoot() {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads')
}

export async function ensureUploadRoot() {
  await fs.mkdir(getUploadRoot(), { recursive: true })
}

export function isValidPlaceId(placeId) {
  return PLACE_ID_RE.test(String(placeId || ''))
}

export function resolvePlaceUploadDir(placeId) {
  if (!isValidPlaceId(placeId)) {
    throw new Error('Invalid place id')
  }

  const uploadRoot = getUploadRoot()
  const targetPath = path.resolve(uploadRoot, placeId)
  assertInsideUploadRoot(targetPath, uploadRoot)
  return targetPath
}

export async function removeStoredFile(storageKey) {
  if (!storageKey) return

  const uploadRoot = getUploadRoot()
  const targetPath = path.resolve(uploadRoot, storageKey)
  assertInsideUploadRoot(targetPath, uploadRoot)

  try {
    await fs.unlink(targetPath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

function assertInsideUploadRoot(targetPath, uploadRoot) {
  const relative = path.relative(uploadRoot, targetPath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid upload path')
  }
}
