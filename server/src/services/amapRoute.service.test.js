import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAmapPolyline, planRoute } from './amapRoute.service.js'

const points = [
  { name: 'A', longitude: 120.1, latitude: 30.1 },
  { name: 'B', longitude: 120.2, latitude: 30.2 },
  { name: 'C', longitude: 120.3, latitude: 30.3 },
]

test('polyline mode returns adjacent straight segments without a key', async () => {
  const result = await planRoute({ travelMode: 'polyline', points })

  assert.equal(result.travelMode, 'polyline')
  assert.equal(result.segments.length, 2)
  assert.deepEqual(result.segments[0].path, [
    [120.1, 30.1],
    [120.2, 30.2],
  ])
  assert.equal(result.fallbackUsed, false)
})

test('rejects fewer than two points', async () => {
  await assert.rejects(() => planRoute({ travelMode: 'polyline', points: [points[0]] }), /至少需要 2 个地点/)
})

test('rejects invalid coordinates', async () => {
  await assert.rejects(
    () => planRoute({ travelMode: 'polyline', points: [{ longitude: 200, latitude: 30 }, points[1]] }),
    /经纬度不合法/,
  )
})

test('driving and walking require backend amap key', async () => {
  await assert.rejects(() => planRoute({ travelMode: 'driving', points }), /缺少 AMAP_WEB_SERVICE_KEY/)
  await assert.rejects(() => planRoute({ travelMode: 'walking', points }), /缺少 AMAP_WEB_SERVICE_KEY/)
})

test('falls back to straight line when amap returns failure', async () => {
  const fetchImpl = async () => jsonResponse({ status: '0', info: 'fail' })
  const result = await planRoute({ travelMode: 'walking', points: points.slice(0, 2) }, { key: 'test-key', fetchImpl })

  assert.equal(result.fallbackUsed, true)
  assert.equal(result.summary.failedSegmentCount, 1)
  assert.equal(result.segments[0].status, 'fallback')
  assert.deepEqual(result.segments[0].path, [
    [120.1, 30.1],
    [120.2, 30.2],
  ])
})

test('parses amap polyline strings into coordinate arrays', () => {
  assert.deepEqual(parseAmapPolyline('120.1234567,30.7654321;120.2,30.3'), [
    [120.123457, 30.765432],
    [120.2, 30.3],
  ])
})

test('walking handles multiple points by adjacent segments', async () => {
  const requested = []
  const fetchImpl = async (url) => {
    requested.push(new URL(url))
    return jsonResponse(amapSuccess('120.1,30.1;120.2,30.2', 100, 50))
  }

  const result = await planRoute({ travelMode: 'walking', points }, { key: 'test-key', fetchImpl })

  assert.equal(requested.length, 2)
  assert.equal(requested[0].pathname, '/v3/direction/walking')
  assert.equal(requested[0].searchParams.get('origin'), '120.1,30.1')
  assert.equal(requested[0].searchParams.get('destination'), '120.2,30.2')
  assert.equal(result.segments.length, 2)
  assert.equal(result.summary.distance, 200)
  assert.equal(result.summary.duration, 100)
})

test('driving splits more than 18 points into continuous groups', async () => {
  const longPoints = Array.from({ length: 20 }, (_, index) => ({
    name: `P${index}`,
    longitude: 120 + index / 1000,
    latitude: 30 + index / 1000,
  }))
  const requested = []
  const fetchImpl = async (url) => {
    requested.push(new URL(url))
    return jsonResponse(amapSuccess('120,30;120.1,30.1', '100', '50'))
  }

  const result = await planRoute({ travelMode: 'driving', points: longPoints }, { key: 'test-key', fetchImpl })

  assert.equal(requested.length, 2)
  assert.equal(requested[0].searchParams.get('origin'), '120,30')
  assert.equal(requested[0].searchParams.get('destination'), '120.017,30.017')
  assert.equal(requested[0].searchParams.get('waypoints').split(';').length, 16)
  assert.equal(requested[1].searchParams.get('origin'), '120.017,30.017')
  assert.equal(requested[1].searchParams.get('destination'), '120.019,30.019')
  assert.equal(result.segments.length, 2)
})

function amapSuccess(polyline, distance, duration) {
  return {
    status: '1',
    route: {
      paths: [
        {
          distance,
          duration,
          steps: [{ polyline }],
        },
      ],
    },
  }
}

function jsonResponse(payload) {
  return {
    ok: true,
    async json() {
      return payload
    },
  }
}
