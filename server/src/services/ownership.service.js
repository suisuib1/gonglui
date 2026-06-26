export function isAdmin(user) {
  return user?.role === 'admin'
}

export function canAccessOwnedRecord(user, record) {
  if (!user || !record) return false
  if (isAdmin(user)) return true
  return record.userId === user.id
}

export function routeListWhere(user) {
  return isAdmin(user) ? {} : { userId: user.id }
}

export async function getRouteForUser(db, routeId, user, options = {}) {
  const include = options.include || undefined
  const select = options.select || undefined

  if (isAdmin(user)) {
    return db.route.findUnique({
      where: { id: routeId },
      ...(include ? { include } : {}),
      ...(select ? { select } : {}),
    })
  }

  return db.route.findFirst({
    where: {
      id: routeId,
      userId: user.id,
    },
    ...(include ? { include } : {}),
    ...(select ? { select } : {}),
  })
}

export async function getPlaceForUser(db, placeId, user) {
  const place = await db.routePlace.findUnique({
    where: { id: placeId },
    include: {
      route: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  })

  if (!place || !canAccessOwnedRecord(user, place.route)) return null
  return place
}

export async function getImageForUser(db, imageId, user) {
  const image = await db.placeImage.findUnique({
    where: { id: imageId },
    include: {
      place: {
        include: {
          route: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      },
    },
  })

  if (!image || !canAccessOwnedRecord(user, image.place?.route)) return null
  return image
}
