import { optimizeRoute, RouteOptimizeError } from '../services/routeOptimize.service.js'

export async function optimizeRouteController(req, res) {
  try {
    const data = await optimizeRoute(req.body)
    res.json({
      code: 0,
      message: 'ok',
      data,
    })
  } catch (error) {
    const status = error instanceof RouteOptimizeError ? error.code : 400
    res.status(status).json({
      code: status,
      message: error instanceof RouteOptimizeError ? error.message : '智能排序失败，请稍后重试。',
      data: null,
    })
  }
}
