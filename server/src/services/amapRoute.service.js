const TRAVEL_MODES = new Set(['polyline', 'driving', 'walking'])
const AMAP_ORIGIN = 'https://restapi.amap.com'
const REQUEST_TIMEOUT_MS = 9000
const MAX_DRIVING_GROUP_POINTS = 18

export class RoutePlanError extends Error {
  constructor(message, code = 400) {
    super(message)
    this.code = code
  }
}

export async function planRoute(payload = {}, options = {}) {
  const travelMode = normalizeTravelMode(payload.travelMode)
  const points = normalizePoints(payload.points)

  if (travelMode === 'polyline') {
    return buildPlanResult(travelMode, buildFallbackAdjacentSegments(points, travelMode, ''))
  }

  const key = String(options.key ?? process.env.AMAP_WEB_SERVICE_KEY ?? '').trim()
  if (!key) {
    throw new RoutePlanError('缺少 AMAP_WEB_SERVICE_KEY，无法规划驾车或步行路线。')
  }

  if (travelMode === 'walking') {
    return planWalking(points, { ...options, key })
  }

  return planDriving(points, { ...options, key })
}

export function parseAmapPolyline(value) {
  return String(value || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [lng, lat] = item.split(',').map(Number)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
      return [roundCoordinate(lng), roundCoordinate(lat)]
    })
    .filter(Boolean)
}

async function planWalking(points, options) {
  const segments = []

  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push(await requestAdjacentSegment(points, index, index + 1, 'walking', options))
  }

  return buildPlanResult('walking', segments)
}

async function planDriving(points, options) {
  const groups = buildDrivingGroups(points)
  const segments = []

  for (const group of groups) {
    const segment = await requestDrivingGroup(points, group.fromIndex, group.toIndex, options)
    if (segment.fallback) {
      segments.push(...buildFallbackAdjacentSegments(points.slice(group.fromIndex, group.toIndex + 1), 'driving', segment.message, group.fromIndex))
    } else {
      segments.push(segment)
    }
  }

  return buildPlanResult('driving', segments)
}

async function requestAdjacentSegment(points, fromIndex, toIndex, mode, options) {
  try {
    const url = buildAmapUrl(mode, {
      key: options.key,
      origin: formatPoint(points[fromIndex]),
      destination: formatPoint(points[toIndex]),
    })
    const payload = await fetchJson(url, options)
    return parseAmapRouteSegment(payload, {
      fromIndex,
      toIndex,
      mode,
      fallbackPath: [toCoordinatePair(points[fromIndex]), toCoordinatePair(points[toIndex])],
    })
  } catch (error) {
    return fallbackSegment(points, fromIndex, toIndex, mode, '高德路线规划失败，已回退直线')
  }
}

async function requestDrivingGroup(points, fromIndex, toIndex, options) {
  try {
    const groupPoints = points.slice(fromIndex, toIndex + 1)
    const waypoints = groupPoints.slice(1, -1).map(formatPoint).join(';')
    const url = buildAmapUrl('driving', {
      key: options.key,
      origin: formatPoint(groupPoints[0]),
      destination: formatPoint(groupPoints[groupPoints.length - 1]),
      waypoints,
    })
    const payload = await fetchJson(url, options)
    return parseAmapRouteSegment(payload, {
      fromIndex,
      toIndex,
      mode: 'driving',
      fallbackPath: [toCoordinatePair(points[fromIndex]), toCoordinatePair(points[toIndex])],
    })
  } catch (error) {
    return fallbackSegment(points, fromIndex, toIndex, 'driving', '高德路线规划失败，已回退直线')
  }
}

function parseAmapRouteSegment(payload, context) {
  const path = payload?.route?.paths?.[0]
  const steps = Array.isArray(path?.steps) ? path.steps : []
  const plannedPath = steps.flatMap((step) => parseAmapPolyline(step.polyline))

  if (payload?.status !== '1' || !path || !steps.length || !plannedPath.length) {
    return {
      fromIndex: context.fromIndex,
      toIndex: context.toIndex,
      mode: context.mode,
      status: 'fallback',
      distance: null,
      duration: null,
      path: context.fallbackPath,
      fallback: true,
      message: '高德路线规划失败，已回退直线',
    }
  }

  return {
    fromIndex: context.fromIndex,
    toIndex: context.toIndex,
    mode: context.mode,
    status: 'success',
    distance: nullableNumber(path.distance),
    duration: nullableNumber(path.duration),
    path: plannedPath,
    fallback: false,
    message: '',
  }
}

async function fetchJson(url, options) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new RoutePlanError('当前 Node 环境不支持 fetch。', 500)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS)

  try {
    const response = await fetchImpl(url, { signal: controller.signal })
    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function buildAmapUrl(mode, params) {
  const url = new URL(mode === 'driving' ? '/v3/direction/driving' : '/v3/direction/walking', AMAP_ORIGIN)
  url.searchParams.set('key', params.key)
  url.searchParams.set('origin', params.origin)
  url.searchParams.set('destination', params.destination)
  if (mode === 'driving' && params.waypoints) {
    url.searchParams.set('waypoints', params.waypoints)
  }
  return url.toString()
}

function buildDrivingGroups(points) {
  const groups = []
  let fromIndex = 0

  while (fromIndex < points.length - 1) {
    const toIndex = Math.min(fromIndex + MAX_DRIVING_GROUP_POINTS - 1, points.length - 1)
    groups.push({ fromIndex, toIndex })
    fromIndex = toIndex
  }

  return groups
}

function buildFallbackAdjacentSegments(points, mode, message = '', offset = 0) {
  return points.slice(0, -1).map((point, index) => fallbackSegment(points, index, index + 1, mode, message, offset))
}

function fallbackSegment(points, fromIndex, toIndex, mode, message = '', offset = 0) {
  return {
    fromIndex: fromIndex + offset,
    toIndex: toIndex + offset,
    mode,
    status: message ? 'fallback' : 'success',
    distance: null,
    duration: null,
    path: [toCoordinatePair(points[fromIndex]), toCoordinatePair(points[toIndex])],
    fallback: Boolean(message),
    message,
  }
}

function buildPlanResult(travelMode, segments) {
  const failedSegmentCount = segments.filter((segment) => segment.fallback).length

  return {
    travelMode,
    segments,
    fallbackUsed: failedSegmentCount > 0,
    summary: {
      distance: sumNullable(segments.map((segment) => segment.distance)),
      duration: sumNullable(segments.map((segment) => segment.duration)),
      segmentCount: segments.length,
      failedSegmentCount,
    },
  }
}

function normalizeTravelMode(value) {
  const travelMode = String(value || 'polyline').trim()
  if (!TRAVEL_MODES.has(travelMode)) {
    throw new RoutePlanError('路线模式只能是 polyline、driving 或 walking。')
  }
  return travelMode
}

function normalizePoints(value) {
  if (!Array.isArray(value) || value.length < 2) {
    throw new RoutePlanError('至少需要 2 个地点才能规划路线。')
  }

  return value.map((point, index) => normalizePoint(point, index))
}

function normalizePoint(point, index) {
  const longitude = Number(point?.longitude ?? point?.lng)
  const latitude = Number(point?.latitude ?? point?.lat)

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new RoutePlanError(`第 ${index + 1} 个地点经纬度不合法。`)
  }

  return {
    longitude: roundCoordinate(longitude),
    latitude: roundCoordinate(latitude),
  }
}

function formatPoint(point) {
  return `${formatCoordinate(point.longitude)},${formatCoordinate(point.latitude)}`
}

function toCoordinatePair(point) {
  return [roundCoordinate(point.longitude), roundCoordinate(point.latitude)]
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
  return numbers.reduce((sum, value) => sum + value, 0)
}
