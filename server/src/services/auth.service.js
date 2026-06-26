import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'

const DEFAULT_JWT_EXPIRES_IN = '7d'
const MIN_PASSWORD_LENGTH = 8

export class AuthError extends Error {
  constructor(message, statusCode = 401, publicCode = 'AUTH_ERROR') {
    super(message)
    this.name = 'AuthError'
    this.statusCode = statusCode
    this.publicCode = publicCode
  }
}

export async function hashPassword(password) {
  const text = String(password || '')
  if (text.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`密码长度不能少于 ${MIN_PASSWORD_LENGTH} 位。`, 400, 'AUTH_PASSWORD_TOO_SHORT')
  }

  return bcrypt.hash(text, 12)
}

export async function authenticateUser(payload = {}, options = {}) {
  const db = options.db || prisma
  const email = normalizeEmail(payload.email)
  const password = String(payload.password || '')

  if (!email || !password) {
    throw new AuthError('邮箱或密码错误。', 401, 'AUTH_INVALID_CREDENTIALS')
  }

  const user = await db.user.findUnique({ where: { email } })
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false

  if (!user || !passwordMatches) {
    throw new AuthError('邮箱或密码错误。', 401, 'AUTH_INVALID_CREDENTIALS')
  }

  if (user.status !== 'active') {
    throw new AuthError('账号已禁用。', 403, 'AUTH_USER_DISABLED')
  }

  return buildAuthPayload(user, options)
}

export async function findActiveUserByToken(token, options = {}) {
  const db = options.db || prisma
  const payload = verifyAuthToken(token, options)
  const user = await db.user.findUnique({ where: { id: payload.id } })

  if (!user) {
    throw new AuthError('登录已失效，请重新登录。', 401, 'AUTH_INVALID_TOKEN')
  }

  if (user.status !== 'active') {
    throw new AuthError('账号已禁用。', 403, 'AUTH_USER_DISABLED')
  }

  return sanitizeUser(user)
}

export function buildAuthPayload(user, options = {}) {
  const issued = issueAuthToken(user, options)

  return {
    token: issued.token,
    expiresAt: issued.expiresAt,
    user: sanitizeUser(user),
  }
}

export function issueAuthToken(user, options = {}) {
  const secret = getJwtSecret(options)
  const expiresIn = String(options.expiresIn || process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN)
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    secret,
    { expiresIn },
  )
  const decoded = jwt.decode(token)

  return {
    token,
    expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
  }
}

export function verifyAuthToken(token, options = {}) {
  const text = String(token || '').trim()
  if (!text) {
    throw new AuthError('请先登录。', 401, 'AUTH_REQUIRED')
  }

  try {
    return jwt.verify(text, getJwtSecret(options))
  } catch (error) {
    throw new AuthError('登录已失效，请重新登录。', 401, 'AUTH_INVALID_TOKEN')
  }
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName || '',
    role: user.role || 'user',
    status: user.status || 'active',
  }
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function getJwtSecret(options = {}) {
  const secret = String(options.secret || process.env.JWT_SECRET || '').trim()
  if (!secret) {
    throw new AuthError('JWT_SECRET 未配置。', 500, 'AUTH_CONFIG_ERROR')
  }

  return secret
}
