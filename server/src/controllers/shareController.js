import { prisma } from '../lib/prisma.js'
import { ensureRouteShare, getSharedRouteByToken } from '../services/routeShare.service.js'

const routeInclude = {
  places: {
    orderBy: { sortOrder: 'asc' },
    include: {
      images: {
        orderBy: { createdAt: 'asc' },
      },
    },
  },
}

export async function createRouteShare(req, res) {
  const payload = await ensureRouteShare(prisma, req.params.id)

  if (!payload) {
    res.status(404).json(fail(404, 'route not found'))
    return
  }

  res.json(ok(payload))
}

export async function getSharedRoute(req, res) {
  const route = await getSharedRouteByToken(prisma, req.params.token, routeInclude)

  if (!route) {
    res.status(404).json(fail(404, 'share not found'))
    return
  }

  res.json(ok(route))
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
