import { apiRequest } from './apiClient'

export function listRoutes() {
  return apiRequest('/api/routes')
}

export function getRoute(id) {
  return apiRequest(`/api/routes/${id}`)
}

export function createRoute(payload) {
  return apiRequest('/api/routes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateRoute(id, payload) {
  return apiRequest(`/api/routes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function updatePlaceNote(id, note) {
  return apiRequest(`/api/places/${id}/note`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  })
}

export function uploadPlaceImage(id, file, type) {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('type', type)

  return apiRequest(`/api/places/${id}/images`, {
    method: 'POST',
    body: formData,
  })
}

export function deleteImage(id) {
  return apiRequest(`/api/images/${id}`, {
    method: 'DELETE',
  })
}
