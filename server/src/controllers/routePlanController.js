import { planRoute, RoutePlanError } from '../services/amapRoute.service.js'

export async function planRouteController(req, res) {
  try {
    const data = await planRoute(req.body)
    res.json({
      code: 0,
      message: 'ok',
      data,
    })
  } catch (error) {
    const status = error instanceof RoutePlanError ? error.code : 400
    res.status(status).json({
      code: status,
      message: error instanceof RoutePlanError ? error.message : '路线规划失败，请稍后重试。',
      data: null,
    })
  }
}
