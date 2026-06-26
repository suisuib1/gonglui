const SERVER_ID_RE = /^c[a-z0-9]{20,}$/i
const TRAVEL_MODES = new Set(['polyline', 'driving', 'walking'])
const MAX_PLANNED_PATH_POINTS = 20000
const MAX_PLANNED_SEGMENTS_JSON_LENGTH = 1_500_000
const MAX_ROUTE_PLACES = 50
const MIN_VALID_ROUTE_PLACES = 2
const MAX_TITLE_LENGTH = 80
const MAX_CITY_LENGTH = 50
const MAX_PLACE_NAME_LENGTH = 100

export class RoutePayloadValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RoutePayloadValidationError'
    this.statusCode = 400
    this.publicCode = 'ROUTE_VALIDATION_ERROR'
  }
}

export function normalizeRoutePayload(payload = {}, options = {}) {
  const validateForSave = Boolean(options.validateForSave)
  const title = cleanString(payload.title)
  const city = cleanString(payload.city)
  const travelMode = cleanString(payload.travelMode) || 'polyline'
  const places = normalizePlacesInput(payload.places, { validateForSave })

  if (validateForSave) {
    validateRouteFields({ title, city, travelMode, places })
  }

  const normalizedPlaces = places.map((place, index) => normalizePlace(place, index, { validateForSave }))

  if (validateForSave) {
    validateRoutePlaces(normalizedPlaces)
  }

  const plannedSnapshot = normalizePlannedSnapshot(payload, {
    defaultTravelMode: travelMode,
    partialPlan: Boolean(options.partialPlan),
  })

  return {
    route: {
      title: validateForSave ? title : title || '未命名路线',
      city: validateForSave ? city : city || '未设置城市',
      travelMode,
      ...plannedSnapshot,
    },
    places: normalizedPlaces,
  }
}

export function serializeRoute(route) {
  return {
    id: route.id,
    title: route.title,
    city: route.city,
    travelMode: route.travelMode,
    plannedTravelMode: route.plannedTravelMode || null,
    plannedSegments: Array.isArray(route.plannedSegments) ? route.plannedSegments : [],
    plannedSummary: route.plannedSummary || null,
    plannedAt: toIso(route.plannedAt),
    createdAt: toIso(route.createdAt),
    updatedAt: toIso(route.updatedAt),
    places: (route.places || [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((place) => ({
        id: place.id,
        order: place.sortOrder,
        inputName: place.name,
        name: place.name,
        address: place.address || '',
        lng: place.longitude ?? null,
        lat: place.latitude ?? null,
        status: place.geocodeStatus,
        note: place.note || '',
        amapPoiId: place.amapPoiId || null,
        images: (place.images || []).map(serializeImage),
      })),
  }
}

export function serializeSharedRoute(route) {
  const serialized = serializeRoute(route)

  return {
    ...serialized,
    places: serialized.places.map((place) => ({
      ...place,
      images: place.images.map((image) => {
        const { storageKey, ...publicImage } = image
        return publicImage
      }),
    })),
  }
}

export function serializeRouteListItem(route) {
  return {
    id: route.id,
    title: route.title,
    city: route.city,
    travelMode: route.travelMode,
    plannedTravelMode: route.plannedTravelMode || null,
    plannedAt: toIso(route.plannedAt),
    hasPlannedRoute: Array.isArray(route.plannedSegments) && route.plannedSegments.length > 0,
    placeCount: route.places.length,
    imageCount: route.places.reduce((sum, place) => sum + place._count.images, 0),
    updatedAt: toIso(route.updatedAt),
    createdAt: toIso(route.createdAt),
  }
}

export function serializeImage(image) {
  return {
    id: image.id,
    type: image.imageType,
    imageType: image.imageType,
    imageUrl: image.imageUrl,
    storageKey: image.storageKey,
    name: image.originalName || image.storageKey,
    originalName: image.originalName,
    size: image.size,
    mimeType: image.mimeType,
    createdAt: toIso(image.createdAt),
  }
}

function normalizePlacesInput(value, options = {}) {
  if (Array.isArray(value)) return value
  if (options.validateForSave) {
    throwRouteValidation('地点列表必须是数组。')
  }
  return []
}

function validateRouteFields({ title, city, travelMode, places }) {
  if (!title) throwRouteValidation('路线名称不能为空。')
  if (title.length > MAX_TITLE_LENGTH) throwRouteValidation(`路线名称不能超过 ${MAX_TITLE_LENGTH} 个字符。`)
  if (!city) throwRouteValidation('城市不能为空。')
  if (city.length > MAX_CITY_LENGTH) throwRouteValidation(`城市不能超过 ${MAX_CITY_LENGTH} 个字符。`)
  if (!TRAVEL_MODES.has(travelMode)) throwRouteValidation('路线模式只能是 polyline、driving 或 walking。')
  if (places.length > MAX_ROUTE_PLACES) throwRouteValidation(`地点数量不能超过 ${MAX_ROUTE_PLACES} 个。`)
  if (places.length < MIN_VALID_ROUTE_PLACES) throwRouteValidation(`至少需要 ${MIN_VALID_ROUTE_PLACES} 个有效经纬度地点。`)
}

function validateRoutePlaces(places) {
  const validPlaceCount = places.filter((place) => Number.isFinite(place.longitude) && Number.isFinite(place.latitude)).length
  if (validPlaceCount < MIN_VALID_ROUTE_PLACES) {
    throwRouteValidation(`至少需要 ${MIN_VALID_ROUTE_PLACES} 个有效经纬度地点。`)
  }
}

function normalizePlace(place = {}, index, options = {}) {
  const name = cleanString(place.name || place.inputName)
  const rawId = cleanString(place.id || place.serverId)

  if (options.validateForSave) {
    validatePlaceName(name, index)
  }

  return {
    clientId: cleanString(place.clientId || place.localId || place.id) || undefined,
    id: SERVER_ID_RE.test(rawId) ? rawId : undefined,
    name: options.validateForSave ? name : name || `地点 ${index + 1}`,
    address: nullableString(place.address),
    longitude: normalizePlaceCoordinate(place.longitude ?? place.lng, {
      index,
      label: '经度',
      min: -180,
      max: 180,
      validateForSave: options.validateForSave,
    }),
    latitude: normalizePlaceCoordinate(place.latitude ?? place.lat, {
      index,
      label: '纬度',
      min: -90,
      max: 90,
      validateForSave: options.validateForSave,
    }),
    sortOrder: normalizeOrder(place.sortOrder ?? place.order, index),
    note: nullableString(place.note),
    geocodeStatus: cleanString(place.geocodeStatus || place.status) || 'pending',
    amapPoiId: nullableString(place.amapPoiId),
  }
}

function validatePlaceName(name, index) {
  if (!name) throwRouteValidation(`第 ${index + 1} 个地点名称不能为空。`)
  if (name.length > MAX_PLACE_NAME_LENGTH) {
    throwRouteValidation(`第 ${index + 1} 个地点名称不能超过 ${MAX_PLACE_NAME_LENGTH} 个字符。`)
  }
}

function normalizePlaceCoordinate(value, options) {
  const number = nullableNumber(value)
  if (!options.validateForSave) return number

  if (!Number.isFinite(number)) {
    throwRouteValidation(`第 ${options.index + 1} 个地点${options.label}必须是合法数字。`)
  }

  if (number < options.min || number > options.max) {
    throwRouteValidation(`第 ${options.index + 1} 个地点${options.label}必须在 ${options.min} 到 ${options.max} 之间。`)
  }

  return Number(number.toFixed(6))
}

function normalizePlannedSnapshot(payload, options) {
  const hasPlannedTravelMode = Object.hasOwn(payload, 'plannedTravelMode')
  const hasPlannedSegments = Object.hasOwn(payload, 'plannedSegments')
  const hasPlannedSummary = Object.hasOwn(payload, 'plannedSummary')
  const hasPlannedAt = Object.hasOwn(payload, 'plannedAt')
  const hasAnyPlannedField = hasPlannedTravelMode || hasPlannedSegments || hasPlannedSummary || hasPlannedAt

  if (options.partialPlan && !hasAnyPlannedField) return {}
  if (!hasAnyPlannedField) return {}

  if (payload.plannedTravelMode === null || payload.plannedSegments === null || payload.plannedSummary === null) {
    return {
      plannedTravelMode: null,
      plannedSegments: null,
      plannedSummary: null,
      plannedAt: null,
    }
  }

  const plannedSegments = normalizePlannedSegments(payload.plannedSegments)

  return {
    plannedTravelMode: normalizePlannedTravelMode(payload.plannedTravelMode || options.defaultTravelMode),
    plannedSegments,
    plannedSummary: normalizePlannedSummary(payload.plannedSummary),
    plannedAt: normalizePlannedAt(payload.plannedAt) || new Date(),
  }
}

function normalizePlannedTravelMode(value) {
  const travelMode = cleanString(value) || 'polyline'
  if (!TRAVEL_MODES.has(travelMode)) {
    throw new Error('plannedTravelMode must be polyline, driving, or walking')
  }
  return travelMode
}

function normalizePlannedSegments(value) {
  if (!Array.isArray(value)) {
    throw new Error('plannedSegments must be an array')
  }

  const segments = value.map(normalizePlannedSegment)
  const pointCount = segments.reduce((sum, segment) => sum + segment.path.length, 0)

  if (pointCount > MAX_PLANNED_PATH_POINTS) {
    throw new Error(`plannedSegments too large: path points cannot exceed ${MAX_PLANNED_PATH_POINTS}`)
  }

  if (JSON.stringify(segments).length > MAX_PLANNED_SEGMENTS_JSON_LENGTH) {
    throw new Error('plannedSegments too large: JSON payload exceeds limit')
  }

  return segments
}

function normalizePlannedSegment(segment = {}) {
  const path = Array.isArray(segment.path) ? segment.path.map(normalizeCoordinatePair).filter(Boolean) : []

  return {
    fromIndex: nullableInteger(segment.fromIndex),
    toIndex: nullableInteger(segment.toIndex),
    mode: nullableString(segment.mode),
    status: nullableString(segment.status),
    distance: nullableNumber(segment.distance),
    duration: nullableNumber(segment.duration),
    path,
    fallback: Boolean(segment.fallback),
    message: nullableString(segment.message),
  }
}

function normalizeCoordinatePair(value) {
  if (!Array.isArray(value) || value.length < 2) return null

  const longitude = Number(value[0])
  const latitude = Number(value[1])
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null

  return [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))]
}

function normalizePlannedSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const summary = {
    distance: nullableNumber(value.distance),
    duration: nullableNumber(value.duration),
    segmentCount: nullableInteger(value.segmentCount),
    failedSegmentCount: nullableInteger(value.failedSegmentCount),
  }

  if (typeof value.fallbackUsed === 'boolean') {
    summary.fallbackUsed = value.fallbackUsed
  }

  return summary
}

function normalizePlannedAt(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeOrder(value, index) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : index + 1
}

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function nullableInteger(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

function nullableString(value) {
  const text = cleanString(value)
  return text || null
}

function cleanString(value) {
  return String(value ?? '').trim()
}

function throwRouteValidation(message) {
  throw new RoutePayloadValidationError(message)
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value
}
