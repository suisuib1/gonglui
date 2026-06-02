import path from 'node:path'
import { prisma } from '../lib/prisma.js'
import { serializeImage } from '../services/routePayload.js'

const VALID_IMAGE_TYPES = new Set(['scenery', 'pose', 'other'])

export async function updatePlaceNote(req, res) {
  try {
    const place = await prisma.routePlace.update({
      where: { id: req.params.id },
      data: {
        note: String(req.body?.note ?? ''),
      },
    })

    res.json(ok({ id: place.id, note: place.note || '' }))
  } catch (error) {
    if (error.code === 'P2025') {
      res.status(404).json(fail(404, '地点不存在'))
      return
    }
    throw error
  }
}

export async function uploadPlaceImage(req, res) {
  if (!req.file) {
    res.status(400).json(fail(400, '请上传 image 文件'))
    return
  }

  const imageType = VALID_IMAGE_TYPES.has(req.body?.type) ? req.body.type : 'other'
  const storageKey = path.join(req.params.id, req.file.filename).replace(/\\/g, '/')

  try {
    const image = await prisma.placeImage.create({
      data: {
        placeId: req.params.id,
        imageType,
        imageUrl: `/uploads/${storageKey}`,
        storageKey,
        originalName: req.file.originalname || null,
        size: req.file.size,
        mimeType: req.file.mimetype,
      },
    })

    res.json(ok(serializeImage(image)))
  } catch (error) {
    if (error.code === 'P2003') {
      res.status(404).json(fail(404, '地点不存在'))
      return
    }
    throw error
  }
}

function ok(data) {
  return {
    code: 0,
    message: 'ok',
    data,
  }
}

function fail(code, message) {
  return {
    code,
    message,
    data: null,
  }
}
