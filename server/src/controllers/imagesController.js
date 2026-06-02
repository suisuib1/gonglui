import { prisma } from '../lib/prisma.js'
import { removeStoredFile } from '../services/fileStorage.js'

export async function deleteImage(req, res) {
  let image

  try {
    image = await prisma.placeImage.delete({
      where: { id: req.params.id },
    })
  } catch (error) {
    if (error.code === 'P2025') {
      res.status(404).json(fail(404, '图片不存在'))
      return
    }
    throw error
  }

  await removeStoredFile(image.storageKey)
  res.json(ok({ id: req.params.id }))
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
