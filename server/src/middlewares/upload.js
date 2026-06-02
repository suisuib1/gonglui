import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { getUploadRoot } from '../services/fileStorage.js'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    const placeId = req.params.id
    const targetDir = path.join(getUploadRoot(), placeId)
    fs.mkdirSync(targetDir, { recursive: true })
    callback(null, targetDir)
  },
  filename(req, file, callback) {
    const extension = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase()
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`)
  },
})

export const uploadPlaceImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(new Error('只允许上传 JPG、PNG、WebP 或 GIF 图片。'))
      return
    }

    callback(null, true)
  },
})
