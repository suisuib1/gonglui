const SERVER_ID_RE = /^c[a-z0-9]{20,}$/i

export function normalizeRoutePayload(payload = {}) {
  const title = cleanString(payload.title) || '未命名路线'
  const city = cleanString(payload.city) || '未设置城市'
  const travelMode = cleanString(payload.travelMode) || 'polyline'
  const places = Array.isArray(payload.places) ? payload.places : []

  return {
    route: {
      title,
      city,
      travelMode,
    },
    places: places.map((place, index) => normalizePlace(place, index)),
  }
}

export function serializeRoute(route) {
  return {
    id: route.id,
    title: route.title,
    city: route.city,
    travelMode: route.travelMode,
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

function normalizePlace(place = {}, index) {
  const name = cleanString(place.name || place.inputName) || `地点 ${index + 1}`
  const rawId = cleanString(place.id || place.serverId)

  return {
    clientId: cleanString(place.clientId || place.localId || place.id) || undefined,
    id: SERVER_ID_RE.test(rawId) ? rawId : undefined,
    name,
    address: nullableString(place.address),
    longitude: nullableNumber(place.longitude ?? place.lng),
    latitude: nullableNumber(place.latitude ?? place.lat),
    sortOrder: normalizeOrder(place.sortOrder ?? place.order, index),
    note: nullableString(place.note),
    geocodeStatus: cleanString(place.geocodeStatus || place.status) || 'pending',
    amapPoiId: nullableString(place.amapPoiId),
  }
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

function nullableString(value) {
  const text = cleanString(value)
  return text || null
}

function cleanString(value) {
  return String(value ?? '').trim()
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value
}
