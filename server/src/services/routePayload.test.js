import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeRoutePayload, serializeRoute } from './routePayload.js'

test('normalizes frontend route places for Prisma writes', () => {
  const result = normalizeRoutePayload({
    title: '杭州路线',
    city: '杭州',
    travelMode: 'polyline',
    places: [
      {
        id: 'frontend-1',
        name: '西湖',
        address: '杭州市西湖区',
        lng: 120.1,
        lat: 30.2,
        order: 1,
        note: '上午拍照',
        status: 'success',
      },
    ],
  })

  assert.equal(result.route.title, '杭州路线')
  assert.equal(result.route.city, '杭州')
  assert.equal(result.route.travelMode, 'polyline')
  assert.deepEqual(result.places[0], {
    clientId: 'frontend-1',
    id: undefined,
    name: '西湖',
    address: '杭州市西湖区',
    longitude: 120.1,
    latitude: 30.2,
    sortOrder: 1,
    note: '上午拍照',
    geocodeStatus: 'success',
    amapPoiId: null,
  })
})

test('serializes Prisma routes into frontend-friendly places and images', () => {
  const route = serializeRoute({
    id: 'route-1',
    title: '杭州路线',
    city: '杭州',
    travelMode: 'polyline',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-02T00:00:00.000Z'),
    places: [
      {
        id: 'place-1',
        name: '西湖',
        address: '杭州市西湖区',
        longitude: 120.1,
        latitude: 30.2,
        sortOrder: 1,
        note: '上午拍照',
        geocodeStatus: 'success',
        amapPoiId: null,
        images: [
          {
            id: 'image-1',
            imageType: 'scenery',
            imageUrl: '/uploads/place-1/photo.webp',
            originalName: 'photo.webp',
            size: 1024,
            mimeType: 'image/webp',
            createdAt: new Date('2026-06-02T01:00:00.000Z'),
          },
        ],
      },
    ],
  })

  assert.equal(route.places[0].lng, 120.1)
  assert.equal(route.places[0].lat, 30.2)
  assert.equal(route.places[0].status, 'success')
  assert.equal(route.places[0].images[0].type, 'scenery')
  assert.equal(route.places[0].images[0].imageUrl, '/uploads/place-1/photo.webp')
})
