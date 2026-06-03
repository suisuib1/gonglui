import { prisma } from '../lib/prisma.js'
import { normalizeRoutePayload, serializeRoute, serializeRouteListItem } from '../services/routePayload.js'

const routeInclude = {
  places: {
    orderBy: { sortOrder: 'asc' },
    include: {
      images: {
        orderBy: { createdAt: 'asc' },
      },
    },
  },
}

export async function createRoute(req, res) {
  const normalized = normalizeRoutePayload(req.body)
  const route = await prisma.route.create({
    data: {
      ...normalized.route,
      places: {
        create: normalized.places.map(toPlaceCreateData),
      },
    },
    include: routeInclude,
  })

  res.json(ok(serializeRoute(route)))
}

export async function listRoutes(req, res) {
  const routes = await prisma.route.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      places: {
        select: {
          id: true,
          _count: {
            select: { images: true },
          },
        },
      },
    },
  })

  res.json(
    ok(
      routes.map(serializeRouteListItem),
    ),
  )
}

export async function getRoute(req, res) {
  const route = await prisma.route.findUnique({
    where: { id: req.params.id },
    include: routeInclude,
  })

  if (!route) {
    res.status(404).json(fail(404, '路线不存在'))
    return
  }

  res.json(ok(serializeRoute(route)))
}

export async function updateRoute(req, res) {
  const normalized = normalizeRoutePayload(req.body, { partialPlan: true })

  const route = await prisma.$transaction(async (tx) => {
    const existing = await tx.route.findUnique({
      where: { id: req.params.id },
      include: {
        places: {
          select: { id: true },
        },
      },
    })

    if (!existing) return null

    await tx.route.update({
      where: { id: req.params.id },
      data: normalized.route,
    })

    const existingPlaceIds = new Set(existing.places.map((place) => place.id))
    const keptPlaceIds = []

    for (const place of normalized.places) {
      if (place.id && existingPlaceIds.has(place.id)) {
        await tx.routePlace.update({
          where: { id: place.id },
          data: toPlaceWriteData(place),
        })
        keptPlaceIds.push(place.id)
      } else {
        const created = await tx.routePlace.create({
          data: {
            routeId: req.params.id,
            ...toPlaceWriteData(place),
          },
        })
        keptPlaceIds.push(created.id)
      }
    }

    await tx.routePlace.deleteMany({
      where: {
        routeId: req.params.id,
        id: { notIn: keptPlaceIds },
      },
    })

    return tx.route.findUnique({
      where: { id: req.params.id },
      include: routeInclude,
    })
  })

  if (!route) {
    res.status(404).json(fail(404, '路线不存在'))
    return
  }

  res.json(ok(serializeRoute(route)))
}

export async function deleteRoute(req, res) {
  try {
    await prisma.route.delete({
      where: { id: req.params.id },
    })
  } catch (error) {
    if (error.code === 'P2025') {
      res.status(404).json(fail(404, '路线不存在'))
      return
    }
    throw error
  }

  res.json(ok({ id: req.params.id }))
}

function toPlaceCreateData(place) {
  return toPlaceWriteData(place)
}

function toPlaceWriteData(place) {
  return {
    name: place.name,
    address: place.address,
    longitude: place.longitude,
    latitude: place.latitude,
    sortOrder: place.sortOrder,
    note: place.note,
    geocodeStatus: place.geocodeStatus,
    amapPoiId: place.amapPoiId,
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
