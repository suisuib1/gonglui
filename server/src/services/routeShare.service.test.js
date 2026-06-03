import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureRouteShare, getSharedRouteByToken } from './routeShare.service.js'

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

function createPrismaDouble(route) {
  const state = { route: route ? { ...route } : null, updates: [] }

  return {
    state,
    route: {
      async findUnique(args) {
        if (args.where.id) {
          return state.route?.id === args.where.id ? { ...state.route } : null
        }
        if (args.where.shareToken) {
          return state.route?.shareToken === args.where.shareToken ? { ...state.route } : null
        }
        return null
      },
      async update(args) {
        state.updates.push(args)
        if (!state.route || state.route.id !== args.where.id) {
          const error = new Error('missing')
          error.code = 'P2025'
          throw error
        }
        state.route = {
          ...state.route,
          ...args.data,
          updatedAt: state.route.updatedAt,
        }
        return { ...state.route }
      },
    },
  }
}

test('generates a share token for a route without one', async () => {
  const prisma = createPrismaDouble({
    id: 'route-1',
    shareToken: null,
    sharedAt: null,
  })

  const result = await ensureRouteShare(prisma, 'route-1', {
    randomBytes: () => Buffer.from('0123456789abcdef01234567'),
  })

  assert.equal(result.shareToken, 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3')
  assert.equal(result.shareUrl, '/share/MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3')
  assert.notEqual(result.shareToken, 'route-1')
  assert.equal(prisma.state.updates.length, 1)
  assert.equal(prisma.state.updates[0].data.shareToken, result.shareToken)
  assert.equal(prisma.state.updates[0].data.sharedAt instanceof Date, true)
})

test('returns the existing token without creating a new share link', async () => {
  const prisma = createPrismaDouble({
    id: 'route-1',
    shareToken: 'existing-token',
    sharedAt: new Date('2026-06-03T00:00:00.000Z'),
  })

  const result = await ensureRouteShare(prisma, 'route-1', {
    randomBytes: () => {
      throw new Error('should not generate')
    },
  })

  assert.equal(result.shareToken, 'existing-token')
  assert.equal(result.shareUrl, '/share/existing-token')
  assert.equal(prisma.state.updates.length, 0)
})

test('returns shared route details by token with places images and planned snapshot', async () => {
  const prisma = createPrismaDouble({
    id: 'route-1',
    title: 'Shared route',
    city: 'Hangzhou',
    travelMode: 'driving',
    shareToken: 'share-token',
    sharedAt: new Date('2026-06-03T00:00:00.000Z'),
    plannedTravelMode: 'driving',
    plannedSegments: [{ path: [[120, 30], [121, 31]] }],
    plannedSummary: { distance: 1000 },
    plannedAt: new Date('2026-06-03T01:00:00.000Z'),
    createdAt: new Date('2026-06-02T00:00:00.000Z'),
    updatedAt: new Date('2026-06-03T00:00:00.000Z'),
    places: [
      {
        id: 'place-1',
        name: 'West Lake',
        address: 'Hangzhou',
        longitude: 120,
        latitude: 30,
        sortOrder: 1,
        note: 'Photo stop',
        geocodeStatus: 'success',
        amapPoiId: 'poi-1',
        images: [
          {
            id: 'image-1',
            imageType: 'scenery',
            imageUrl: '/uploads/place-1/a.jpg',
            storageKey: 'place-1/a.jpg',
            originalName: 'a.jpg',
            size: 123,
            mimeType: 'image/jpeg',
            createdAt: new Date('2026-06-03T02:00:00.000Z'),
          },
        ],
      },
    ],
  })

  const route = await getSharedRouteByToken(prisma, 'share-token', routeInclude)

  assert.equal(route.title, 'Shared route')
  assert.equal(route.places[0].note, 'Photo stop')
  assert.equal(route.places[0].images[0].imageUrl, '/uploads/place-1/a.jpg')
  assert.deepEqual(route.plannedSegments[0].path, [[120, 30], [121, 31]])
  assert.equal('shareToken' in route, false)
  assert.equal('storageKey' in route.places[0].images[0], false)
})

test('returns null for missing or deleted share token', async () => {
  const prisma = createPrismaDouble(null)

  const route = await getSharedRouteByToken(prisma, 'missing-token', routeInclude)

  assert.equal(route, null)
})
