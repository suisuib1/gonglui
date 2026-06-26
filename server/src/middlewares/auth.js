import { prisma } from '../lib/prisma.js'
import { AuthError, findActiveUserByToken } from '../services/auth.service.js'
import { getImageForUser, getPlaceForUser } from '../services/ownership.service.js'

export function requireAuth(options = {}) {
  return async (req, res, next) => {
    try {
      const token = extractBearerToken(req.headers.authorization)
      req.user = await findActiveUserByToken(token, { db: options.db || prisma })
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function requireAdmin() {
  return (req, res, next) => {
    if (req.user?.role === 'admin') {
      next()
      return
    }

    next(new AuthError('需要管理员权限。', 403, 'AUTH_ADMIN_REQUIRED'))
  }
}

export function requirePlaceOwner(paramName = 'id', options = {}) {
  return async (req, res, next) => {
    try {
      const place = await getPlaceForUser(options.db || prisma, req.params[paramName], req.user)
      if (!place) {
        next(notFound())
        return
      }

      req.authorizedPlace = place
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function requireImageOwner(paramName = 'id', options = {}) {
  return async (req, res, next) => {
    try {
      const image = await getImageForUser(options.db || prisma, req.params[paramName], req.user)
      if (!image) {
        next(notFound())
        return
      }

      req.authorizedImage = image
      next()
    } catch (error) {
      next(error)
    }
  }
}

function extractBearerToken(header) {
  const value = String(header || '').trim()
  const match = value.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    throw new AuthError('请先登录。', 401, 'AUTH_REQUIRED')
  }

  return match[1]
}

function notFound() {
  const error = new Error('资源不存在。')
  error.statusCode = 404
  error.publicCode = 'NOT_FOUND'
  return error
}
