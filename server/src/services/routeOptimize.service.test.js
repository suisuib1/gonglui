import assert from 'node:assert/strict'
import test from 'node:test'
import { optimizeRoute } from './routeOptimize.service.js'

const points = [
  { name: 'A', longitude: 120, latitude: 30 },
  { name: 'B', longitude: 120.2, latitude: 30 },
  { name: 'C', longitude: 120.05, latitude: 30 },
  { name: 'D', longitude: 120.1, latitude: 30 },
]

test('rejects fewer than two points', async () => {
  await assert.rejects(() => optimizeRoute({ travelMode: 'polyline', points: [points[0]] }), /至少需要 2 个地点/)
})

test('keeps the first point fixed as the route start', async () => {
  const result = await optimizeRoute({ travelMode: 'polyline', points })

  assert.equal(result.optimizedOrder[0], 0)
  assert.deepEqual(result.orderedPoints[0], points[0])
})

test('optimized order contains every original index exactly once', async () => {
  const result = await optimizeRoute({ travelMode: 'polyline', points })

  assert.deepEqual([...result.optimizedOrder].sort((a, b) => a - b), [0, 1, 2, 3])
})

test('polyline mode does not require amap web service key', async () => {
  const result = await optimizeRoute({ travelMode: 'polyline', points }, { key: '' })

  assert.equal(result.travelMode, 'polyline')
  assert.equal(result.summary.pairCount, 12)
})

test('driving and walking require amap web service key', async () => {
  await assert.rejects(() => optimizeRoute({ travelMode: 'driving', points }), /缺少 AMAP_WEB_SERVICE_KEY/)
  await assert.rejects(() => optimizeRoute({ travelMode: 'walking', points }), /缺少 AMAP_WEB_SERVICE_KEY/)
})

test('falls back to straight-line distance for failed pairs without failing optimization', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    if (calls === 1) return jsonResponse({ status: '0', info: 'fail' })
    return jsonResponse(amapSuccess(10, 5))
  }

  const result = await optimizeRoute({ travelMode: 'driving', points: points.slice(0, 3) }, { key: 'secret-key', fetchImpl })

  assert.equal(result.optimizedOrder.length, 3)
  assert.equal(result.summary.pairCount, 6)
  assert.equal(result.summary.fallbackPairCount, 1)
  assert.equal(JSON.stringify(result).includes('secret-key'), false)
})

test('throttles amap pair requests when a pair delay is configured', async () => {
  const delays = []
  const fetchImpl = async () => jsonResponse(amapSuccess(10, 5))
  const sleepImpl = async (delayMs) => {
    delays.push(delayMs)
  }

  await optimizeRoute(
    { travelMode: 'walking', points: points.slice(0, 3) },
    { key: 'secret-key', fetchImpl, pairDelayMs: 123, sleepImpl },
  )

  assert.deepEqual(delays, [123, 123, 123, 123, 123])
})

test('handles 11 to 20 points with a complete heuristic order', async () => {
  const manyPoints = Array.from({ length: 12 }, (_, index) => ({
    name: `P${index}`,
    longitude: 120 + index / 1000,
    latitude: 30 + index / 1000,
  }))
  const result = await optimizeRoute({ travelMode: 'polyline', points: manyPoints })

  assert.equal(result.optimizedOrder.length, 12)
  assert.equal(new Set(result.optimizedOrder).size, 12)
  assert.equal(result.optimizedOrder[0], 0)
})

test('rejects more than 20 points', async () => {
  const manyPoints = Array.from({ length: 21 }, (_, index) => ({
    longitude: 120 + index / 1000,
    latitude: 30,
  }))

  await assert.rejects(() => optimizeRoute({ travelMode: 'polyline', points: manyPoints }), /地点过多/)
})

test('rejects returnToStart for the first version', async () => {
  await assert.rejects(
    () => optimizeRoute({ travelMode: 'polyline', points, options: { returnToStart: true } }),
    /暂不支持回到起点/,
  )
})

function amapSuccess(distance, duration) {
  return {
    status: '1',
    route: {
      paths: [
        {
          distance: String(distance),
          duration: String(duration),
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
