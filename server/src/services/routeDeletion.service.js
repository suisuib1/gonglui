import { prisma } from '../lib/prisma.js'
import { removeStoredFile } from './fileStorage.js'

export async function deleteRouteAndUploads(routeId, options = {}) {
  const db = options.db || prisma
  const removeFile = options.removeFile || removeStoredFile
  const logger = options.logger || console

  const route = await db.route.findUnique({
    where: { id: routeId },
    include: {
      places: {
        include: {
          images: {
            select: {
              id: true,
              storageKey: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  })

  if (!route) return null

  try {
    await db.route.delete({
      where: { id: routeId },
    })
  } catch (error) {
    if (error.code === 'P2025') return null
    throw error
  }

  const images = route.places.flatMap((place) => place.images)

  for (const image of images) {
    try {
      await removeFile(image.storageKey)
    } catch (error) {
      logger.warn?.('Failed to clean route upload file', {
        routeId,
        imageId: image.id,
        errorCode: error.code || 'UNKNOWN',
      })
    }
  }

  return { id: routeId }
}
