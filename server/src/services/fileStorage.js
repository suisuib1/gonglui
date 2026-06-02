import fs from 'node:fs/promises'
import path from 'node:path'

export function getUploadRoot() {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads')
}

export async function ensureUploadRoot() {
  await fs.mkdir(getUploadRoot(), { recursive: true })
}

export async function removeStoredFile(storageKey) {
  if (!storageKey) return

  const targetPath = path.resolve(getUploadRoot(), storageKey)
  if (!targetPath.startsWith(getUploadRoot())) return

  try {
    await fs.unlink(targetPath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}
