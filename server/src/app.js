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

export async function createApp() {
  await ensureUploadRoot()

  const app = express()
  const corsMiddleware = cors(buildCorsOptions())

  app.use(corsMiddleware)
  app.options(/.*/, corsMiddleware)
  app.use(express.json({ limit: '1mb' }))
  app.get('/', healthHandler)
  app.get('/health', healthHandler)
  app.use('/uploads', express.static(getUploadRoot()))
  app.use('/api', apiRouter)

  app.use((error, req, res, next) => {
    if (error?.message) {
      res.status(error.code || 400).json({
        code: error.code || 400,
        message: error.message,
        data: null,
      })
      return
    }

    next(error)
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

function buildCorsOptions() {
  const allowedOrigins = parseCorsOrigins()

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
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
