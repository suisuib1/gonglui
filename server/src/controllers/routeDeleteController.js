import { deleteRouteAndUploads } from '../services/routeDeletion.service.js'

export async function deleteRoute(req, res) {
  const deleted = await deleteRouteAndUploads(req.params.id)

  if (!deleted) {
    res.status(404).json(fail(404, '路线不存在'))
    return
  }

  res.json(ok({ id: req.params.id }))
}

function ok(data) {
  return {
    code: 0,
    message: 'ok',
    data,
  }
}

function fail(code, message) {
  return {
    code,
    message,
    data: null,
  }
}
