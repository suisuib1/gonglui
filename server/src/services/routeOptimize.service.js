const TRAVEL_MODES = new Set(['polyline', 'driving', 'walking'])
const AMAP_ORIGIN = 'https://restapi.amap.com'
const REQUEST_TIMEOUT_MS = 9000
const MAX_POINTS = 20

export class RouteOptimizeError extends Error {
  constructor(message, code = 400) {
    super(message)
    this.code = code
  }
}

export async function optimizeRoute(payload = {}, options = {}) {
  const travelMode = normalizeTravelMode(payload.travelMode)
  const points = normalizePoints(payload.points)
  const objective = normalizeObjective(payload.options?.objective)

  if (payload.options?.returnToStart === true) {
    throw new RouteOptimizeError('第一版暂不支持回到起点。')
  }

  if (travelMode !== 'polyline') {
    const key = String(options.key ?? process.env.AMAP_WEB_SERVICE_KEY ?? '').trim()
    if (!key) {
      throw new RouteOptimizeError('缺少 AMAP_WEB_SERVICE_KEY，无法进行驾车或步行智能排序。')
    }
    options = { ...options, key }
  }

  const matrix = await buildCostMatrix(travelMode, points, options)
  const optimizedOrder = optimizeOrder(matrix, objective)
  const segments = buildOrderedSegments(matrix, optimizedOrder)

  return {
    travelMode,
    objective,
    originalOrder: points.map((point, index) => index),
    optimizedOrder,
    orderedPoints: optimizedOrder.map((index) => points[index].source),
    summary: {
      estimatedDistance: sumNullable(segments.map((segment) => segment.distance)),
      estimatedDuration: sumNullable(segments.map((segment) => segment.duration)),
      pairCount: matrix.pairCount,
      fallbackPairCount: matrix.fallbackPairCount,
    },
    segments,
  }
}

async function buildCostMatrix(mode, points, options) {
  const costs = Array.from({ length: points.length }, () => Array(points.length).fill(null))
  let pairCount = 0
  let fallbackPairCount = 0

  for (let fromIndex = 0; fromIndex < points.length; fromIndex += 1) {
    for (let toIndex = 0; toIndex < points.length; toIndex += 1) {
      if (fromIndex === toIndex) continue
      pairCount += 1
      const cost = await getPairRouteCost(mode, points[fromIndex], points[toIndex], options)
      if (cost.fallback) fallbackPairCount += 1
      costs[fromIndex][toIndex] = {
        fromIndex,
        toIndex,
        ...cost,
      }
    }
  }

  return {
    costs,
    pairCount,
    fallbackPairCount,
  }
}

async function getPairRouteCost(mode, from, to, options) {
  const straightDistance = haversineDistance(from, to)

  if (mode === 'polyline') {
    return {
      distance: straightDistance,
      duration: null,
      cost: straightDistance,
      fallback: false,
      message: '',
    }
  }

  try {
    const payload = await fetchAmapPair(mode, from, to, options)
    const path = payload?.route?.paths?.[0]
    if (payload?.status !== '1' || !path) {
      return fallbackCost(straightDistance)
    }

    const distance = nullableNumber(path.distance)
    const duration = nullableNumber(path.duration)
    if (!Number.isFinite(distance) && !Number.isFinite(duration)) {
      return fallbackCost(straightDistance)
    }

    return {
      distance,
      duration,
      cost: Number.isFinite(duration) ? duration : distance,
      fallback: false,
      message: '',
    }
  } catch (error) {
    return fallbackCost(straightDistance)
  }
}

async function fetchAmapPair(mode, from, to, options) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new RouteOptimizeError('当前 Node 环境不支持 fetch。', 500)
  }

  const url = new URL(mode === 'driving' ? '/v3/direction/driving' : '/v3/direction/walking', AMAP_ORIGIN)
  url.searchParams.set('key', options.key)
  url.searchParams.set('origin', formatPoint(from))
  url.searchParams.set('destination', formatPoint(to))
  url.searchParams.set('output', 'json')
  url.searchParams.set('extensions', 'base')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS)

  try {
    const response = await fetchImpl(url.toString(), { signal: controller.signal })
    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function optimizeOrder(matrix, objective) {
  const unvisited = new Set(matrix.costs.map((item, index) => index).slice(1))
  const order = [0]

  while (unvisited.size) {
    const current = order[order.length - 1]
    let next = null
    let bestCost = Infinity

    for (const candidate of unvisited) {
      const cost = getObjectiveCost(matrix.costs[current][candidate], objective)
      if (cost < bestCost) {
        bestCost = cost
        next = candidate
      }
    }

    order.push(next)
    unvisited.delete(next)
  }

  return twoOpt(order, matrix, objective)
}

function twoOpt(order, matrix, objective) {
  let improved = true
  let best = order

  while (improved) {
    improved = false
    for (let i = 1; i < best.length - 2; i += 1) {
      for (let j = i + 1; j < best.length - 1; j += 1) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)]
        if (routeCost(candidate, matrix, objective) < routeCost(best, matrix, objective)) {
          best = candidate
          improved = true
        }
      }
    }
  }

  return best
}

function routeCost(order, matrix, objective) {
  return order.slice(0, -1).reduce((sum, fromIndex, index) => {
    const toIndex = order[index + 1]
    return sum + getObjectiveCost(matrix.costs[fromIndex][toIndex], objective)
  }, 0)
}

function getObjectiveCost(pair, objective) {
  if (!pair) return Infinity
  if (objective === 'duration' && Number.isFinite(pair.duration)) return pair.duration
  if (Number.isFinite(pair.distance)) return pair.distance
  return pair.cost
}

function buildOrderedSegments(matrix, optimizedOrder) {
  return optimizedOrder.slice(0, -1).map((fromIndex, index) => {
    const toIndex = optimizedOrder[index + 1]
    const pair = matrix.costs[fromIndex][toIndex]
    return {
      fromIndex,
      toIndex,
      status: pair.fallback ? 'fallback' : 'success',
      distance: pair.distance,
      duration: pair.duration,
      fallback: pair.fallback,
      message: pair.message,
    }
  })
}

function normalizeTravelMode(value) {
  const travelMode = String(value || 'polyline').trim()
  if (!TRAVEL_MODES.has(travelMode)) {
    throw new RouteOptimizeError('路线模式只能是 polyline、driving 或 walking。')
  }
  return travelMode
}

function normalizeObjective(value) {
  return value === 'distance' ? 'distance' : 'duration'
}

function normalizePoints(value) {
  if (!Array.isArray(value) || value.length < 2) {
    throw new RouteOptimizeError('至少需要 2 个地点才能智能排序。')
  }

  if (value.length > MAX_POINTS) {
    throw new RouteOptimizeError('地点过多，最多支持 20 个地点，请拆分路线。')
  }

  return value.map((point, index) => normalizePoint(point, index))
}

function normalizePoint(point, index) {
  const longitude = Number(point?.longitude ?? point?.lng)
  const latitude = Number(point?.latitude ?? point?.lat)

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new RouteOptimizeError(`第 ${index + 1} 个地点经纬度不合法。`)
  }

  return {
    longitude: roundCoordinate(longitude),
    latitude: roundCoordinate(latitude),
    source: {
      ...point,
      longitude: roundCoordinate(longitude),
      latitude: roundCoordinate(latitude),
    },
  }
}

function fallbackCost(distance) {
  return {
    distance,
    duration: null,
    cost: distance,
    fallback: true,
    message: '高德成本估算失败，已使用直线距离。',
  }
}

function formatPoint(point) {
  return `${formatCoordinate(point.longitude)},${formatCoordinate(point.latitude)}`
}

function formatCoordinate(value) {
  return String(roundCoordinate(value))
}

function roundCoordinate(value) {
  return Number(Number(value).toFixed(6))
}

function nullableNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function sumNullable(values) {
  const numbers = values.filter((value) => Number.isFinite(value))
  if (!numbers.length) return null
  return Math.round(numbers.reduce((sum, value) => sum + value, 0))
}

function haversineDistance(from, to) {
  const earthRadius = 6371000
  const fromLat = toRadians(from.latitude)
  const toLat = toRadians(to.latitude)
  const deltaLat = toRadians(to.latitude - from.latitude)
  const deltaLng = toRadians(to.longitude - from.longitude)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(earthRadius * c)
}

function toRadians(value) {
  return (value * Math.PI) / 180
}
