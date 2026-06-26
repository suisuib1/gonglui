import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeRoutePayload, serializeRoute, serializeRouteListItem } from './routePayload.js'

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

test('validates route save payload before Prisma writes', () => {
  const result = normalizeRoutePayload(
    {
      title: '杭州路线',
      city: '杭州',
      travelMode: 'walking',
      places: [
        {
          id: 'frontend-1',
          name: '西湖',
          lng: '120.1',
          lat: '30.2',
          order: 1,
          status: 'success',
        },
        {
          id: 'frontend-2',
          name: '灵隐寺',
          longitude: 120.12,
          latitude: 30.24,
          order: 2,
          status: 'success',
        },
      ],
    },
    { validateForSave: true },
  )

  assert.equal(result.route.title, '杭州路线')
  assert.equal(result.route.city, '杭州')
  assert.equal(result.route.travelMode, 'walking')
  assert.equal(result.places.length, 2)
  assert.equal(result.places[0].longitude, 120.1)
  assert.equal(result.places[0].latitude, 30.2)
})

test('rejects blank route title when saving a route', () => {
  assert.throws(
    () =>
      normalizeRoutePayload(
        {
          title: '   ',
          city: '杭州',
          travelMode: 'polyline',
          places: validRoutePlaces(),
        },
        { validateForSave: true },
      ),
    /路线名称不能为空/,
  )
})

test('rejects invalid route travel mode when saving a route', () => {
  assert.throws(
    () =>
      normalizeRoutePayload(
        {
          title: '杭州路线',
          city: '杭州',
          travelMode: 'bicycle',
          places: validRoutePlaces(),
        },
        { validateForSave: true },
      ),
    /路线模式只能是 polyline、driving 或 walking/,
  )
})

test('rejects non-array route places when saving a route', () => {
  assert.throws(
    () =>
      normalizeRoutePayload(
        {
          title: '杭州路线',
          city: '杭州',
          travelMode: 'polyline',
          places: '西湖',
        },
        { validateForSave: true },
      ),
    /地点列表必须是数组/,
  )
})

test('rejects route saves with fewer than two valid coordinate places', () => {
  assert.throws(
    () =>
      normalizeRoutePayload(
        {
          title: '杭州路线',
          city: '杭州',
          travelMode: 'polyline',
          places: [{ name: '西湖', lng: 120.1, lat: 30.2 }],
        },
        { validateForSave: true },
      ),
    /至少需要 2 个有效经纬度地点/,
  )
})

test('rejects route saves with invalid place coordinates instead of storing dirty data', () => {
  assert.throws(
    () =>
      normalizeRoutePayload(
        {
          title: '杭州路线',
          city: '杭州',
          travelMode: 'polyline',
          places: [
            { name: '西湖', lng: 120.1, lat: 30.2 },
            { name: '灵隐寺', lng: 200, lat: 30.24 },
          ],
        },
        { validateForSave: true },
      ),
    /第 2 个地点经度必须在 -180 到 180 之间/,
  )
})

test('rejects route saves with overlong title, city, or place names', () => {
  assert.throws(
    () =>
      normalizeRoutePayload(
        {
          title: '杭'.repeat(81),
          city: '杭州',
          travelMode: 'polyline',
          places: validRoutePlaces(),
        },
        { validateForSave: true },
      ),
    /路线名称不能超过 80 个字符/,
  )

  assert.throws(
    () =>
      normalizeRoutePayload(
        {
          title: '杭州路线',
          city: '杭'.repeat(51),
          travelMode: 'polyline',
          places: validRoutePlaces(),
        },
        { validateForSave: true },
      ),
    /城市不能超过 50 个字符/,
  )

  assert.throws(
    () =>
      normalizeRoutePayload(
        {
          title: '杭州路线',
          city: '杭州',
          travelMode: 'polyline',
          places: [{ name: '西'.repeat(101), lng: 120.1, lat: 30.2 }, validRoutePlaces()[1]],
        },
        { validateForSave: true },
      ),
    /第 1 个地点名称不能超过 100 个字符/,
  )
})

test('rejects route saves with too many places', () => {
  assert.throws(
    () =>
      normalizeRoutePayload(
        {
          title: '杭州路线',
          city: '杭州',
          travelMode: 'polyline',
          places: Array.from({ length: 51 }, (_, index) => ({
            name: `地点 ${index + 1}`,
            lng: 120 + index / 1000,
            lat: 30,
          })),
        },
        { validateForSave: true },
      ),
    /地点数量不能超过 50 个/,
  )
})

test('normalizes planned route snapshot for Prisma writes when provided', () => {
  const result = normalizeRoutePayload({
    title: 'Planned route',
    city: 'Hangzhou',
    travelMode: 'driving',
    plannedTravelMode: 'driving',
    plannedSegments: [
      {
        fromIndex: 0,
        toIndex: 1,
        mode: 'driving',
        distance: 1200,
        duration: 300,
        fallback: false,
        message: '',
        path: [
          [120.1, 30.1],
          [120.2, 30.2],
        ],
      },
    ],
    plannedSummary: {
      distance: 1200,
      duration: 300,
      segmentCount: 1,
      failedSegmentCount: 0,
    },
  })

  assert.equal(result.route.plannedTravelMode, 'driving')
  assert.equal(result.route.plannedAt instanceof Date, true)
  assert.deepEqual(result.route.plannedSegments[0].path, [
    [120.1, 30.1],
    [120.2, 30.2],
  ])
  assert.deepEqual(result.route.plannedSummary, {
    distance: 1200,
    duration: 300,
    segmentCount: 1,
    failedSegmentCount: 0,
  })
})

test('omits planned route fields on update when they are not provided', () => {
  const result = normalizeRoutePayload(
    {
      title: 'No plan update',
      city: 'Hangzhou',
      travelMode: 'walking',
      places: [],
    },
    { partialPlan: true },
  )

  assert.equal('plannedTravelMode' in result.route, false)
  assert.equal('plannedSegments' in result.route, false)
  assert.equal('plannedSummary' in result.route, false)
  assert.equal('plannedAt' in result.route, false)
})

test('normalizes explicit null planned route fields for clearing saved snapshots', () => {
  const result = normalizeRoutePayload(
    {
      title: 'Clear plan',
      city: 'Hangzhou',
      travelMode: 'walking',
      plannedTravelMode: null,
      plannedSegments: null,
      plannedSummary: null,
    },
    { partialPlan: true },
  )

  assert.equal(result.route.plannedTravelMode, null)
  assert.equal(result.route.plannedSegments, null)
  assert.equal(result.route.plannedSummary, null)
  assert.equal(result.route.plannedAt, null)
})

test('rejects planned route segments when they are not an array', () => {
  assert.throws(
    () =>
      normalizeRoutePayload({
        plannedTravelMode: 'driving',
        plannedSegments: { path: [] },
        plannedSummary: {},
      }),
    /plannedSegments/,
  )
})

test('rejects planned route snapshots with too many path points', () => {
  const path = Array.from({ length: 20001 }, (_, index) => [120 + index / 100000, 30])

  assert.throws(
    () =>
      normalizeRoutePayload({
        plannedTravelMode: 'driving',
        plannedSegments: [{ path }],
        plannedSummary: {},
      }),
    /too large/,
  )
})

test('serializes Prisma routes into frontend-friendly places and images', () => {
  const route = serializeRoute({
    id: 'route-1',
    title: '杭州路线',
    city: '杭州',
    travelMode: 'polyline',
    plannedTravelMode: 'driving',
    plannedSegments: [
      {
        fromIndex: 0,
        toIndex: 1,
        path: [
          [120.1, 30.2],
          [120.3, 30.4],
        ],
      },
    ],
    plannedSummary: {
      distance: 100,
      duration: 20,
      segmentCount: 1,
      failedSegmentCount: 0,
    },
    plannedAt: new Date('2026-06-02T02:00:00.000Z'),
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
  assert.equal(route.plannedTravelMode, 'driving')
  assert.deepEqual(route.plannedSegments[0].path, [
    [120.1, 30.2],
    [120.3, 30.4],
  ])
  assert.equal(route.plannedSummary.distance, 100)
  assert.equal(route.plannedAt, '2026-06-02T02:00:00.000Z')
})

test('serializes route list item without full planned segments', () => {
  const item = serializeRouteListItem({
    id: 'route-1',
    title: 'List route',
    city: 'Hangzhou',
    travelMode: 'driving',
    plannedTravelMode: 'driving',
    plannedSegments: [{ path: [[120, 30]] }],
    shareToken: 'share-token',
    plannedAt: new Date('2026-06-02T02:00:00.000Z'),
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-02T00:00:00.000Z'),
    places: [{ id: 'place-1', _count: { images: 2 } }],
  })

  assert.equal(item.hasPlannedRoute, true)
  assert.equal(item.plannedTravelMode, 'driving')
  assert.equal(item.plannedAt, '2026-06-02T02:00:00.000Z')
  assert.equal('plannedSegments' in item, false)
  assert.equal('shareToken' in item, false)
})

function validRoutePlaces() {
  return [
    { name: '西湖', lng: 120.1, lat: 30.2, order: 1, status: 'success' },
    { name: '灵隐寺', lng: 120.12, lat: 30.24, order: 2, status: 'success' },
  ]
}
