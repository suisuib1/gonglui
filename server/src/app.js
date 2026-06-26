import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { apiRouter } from './routes/index.js'
import { ensureUploadRoot, getUploadRoot } from './services/fileStorage.js'

dotenv.config()

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://gonglui-qd.pages.dev',
]

const prismaStatusByCode = new Map([
  ['P2025', 404],
  ['P2002', 409],
  ['P2003', 409],
])
const prismaDatabaseConnectionCodes = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1009', 'P1010', 'P1011', 'P1017'])

export async function createApp() {
  await ensureUploadRoot()

  const app = express()
  const allowedOrigins = parseCorsOrigins()
  const corsMiddleware = cors(buildCorsOptions(allowedOrigins))

  app.use(corsMiddleware)
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }

    next()
  })
  app.use(express.json({ limit: '1mb' }))
  app.get('/', healthHandler)
  app.get('/health', healthHandler)
  app.get('/api/debug/cors', (req, res) => {
    res.json({
      ok: true,
      origin: req.headers.origin || null,
      allowedOrigins,
    })
  })
  app.use('/uploads', express.static(getUploadRoot()))
  app.use('/api', apiRouter)

  app.use((error, req, res, next) => {
    if (!error) {
      next(error)
      return
    }

    const status = mapErrorToHttpStatus(error)
    res.status(status).json(buildErrorResponse(error, status))
  })

  app.use((req, res) => {
    res.status(404).json({
      code: 404,
      message: `API not found: ${req.method} ${req.path}`,
      data: null,
    })
  })

  return app
}

export function parseCorsOrigins(value = process.env.CORS_ORIGIN) {
  const envOrigins = String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return envOrigins.length ? envOrigins : defaultAllowedOrigins
}

export function mapErrorToHttpStatus(error = {}) {
  const explicitStatus = firstValidHttpStatus(error.statusCode, error.status, typeof error.code === 'number' ? error.code : null)
  if (explicitStatus) return explicitStatus

  const errorCode = typeof error.code === 'string' ? error.code : ''

  if (prismaStatusByCode.has(errorCode)) return prismaStatusByCode.get(errorCode)
  if (isPrismaDatabaseConnectionError(error)) return 503
  if (isMulterError(error)) return 400
  if (isCorsOriginError(error)) return 403

  return 500
}

export function buildErrorResponse(error = {}, status = mapErrorToHttpStatus(error), options = {}) {
  const safeStatus = isValidHttpStatus(status) ? status : 500

  return {
    success: false,
    message: getPublicErrorMessage(error, safeStatus, options),
    code: getPublicErrorCode(error, safeStatus),
    data: null,
  }
}

function firstValidHttpStatus(...values) {
  for (const value of values) {
    const number = Number(value)
    if (isValidHttpStatus(number)) return number
  }

  return null
}

function isValidHttpStatus(value) {
  return Number.isInteger(value) && value >= 400 && value <= 599
}

function isPrismaDatabaseConnectionError(error) {
  if (prismaDatabaseConnectionCodes.has(error?.code)) return true
  if (error?.name === 'PrismaClientInitializationError') return true
  if (error?.name === 'PrismaClientRustPanicError') return true
  return false
}

function isMulterError(error) {
  return error?.name === 'MulterError' || String(error?.code || '').startsWith('LIMIT_')
}

function isCorsOriginError(error) {
  return String(error?.message || '').startsWith('Not allowed by CORS:')
}

function getPublicErrorCode(error, status) {
  if (typeof error.publicCode === 'string' && error.publicCode.trim()) return error.publicCode
  if (typeof error.errorCode === 'string' && error.errorCode.trim()) return error.errorCode
  if (isPrismaDatabaseConnectionError(error)) return 'DATABASE_UNAVAILABLE'
  if (typeof error.code === 'string' && prismaStatusByCode.has(error.code)) return error.code
  if (isMulterError(error) && typeof error.code === 'string') return error.code
  if (status === 400) return 'BAD_REQUEST'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 503) return 'SERVICE_UNAVAILABLE'
  return 'INTERNAL_SERVER_ERROR'
}

function getPublicErrorMessage(error, status, options = {}) {
  if (isPrismaDatabaseConnectionError(error)) return '数据库暂时不可用，请稍后重试。'
  if (status === 404 && error?.code === 'P2025') return '记录不存在。'
  if (status === 409 && error?.code === 'P2002') return '数据唯一约束冲突。'
  if (status === 409 && error?.code === 'P2003') return '关联数据无效。'
  if (status >= 500 && options.nodeEnv === 'production') return '服务器内部错误，请稍后重试。'
  if (status >= 500) return '服务器内部错误，请稍后重试。'
  return String(error?.message || '请求处理失败。')
}

function buildCorsOptions(allowedOrigins) {
  return {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
    preflightContinue: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error(`Not allowed by CORS: ${origin}`))
    },
  }
}

function healthHandler(req, res) {
  res.json({
    code: 0,
    message: 'ok',
    data: {
      status: 'ok',
      time: new Date().toISOString(),
    },
  })
}

export const app = await createApp()
