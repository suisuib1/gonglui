const PLACE_SPLIT_RE = /[\n,，、;；]+/g

export function parsePlaceNames(input) {
  return String(input || '')
    .split(PLACE_SPLIT_RE)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function createPendingPlaces(names) {
  return names.map((name, index) => ({
    id: `${Date.now()}-${index}-${name}`,
    order: index + 1,
    inputName: name,
    name,
    address: '',
    lng: null,
    lat: null,
    status: 'pending',
    note: '',
    images: [],
  }))
}
