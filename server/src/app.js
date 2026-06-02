import path from 'node:path'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { apiRouter } from './routes/index.js'
import { ensureUploadRoot, getUploadRoot } from './services/fileStorage.js'

dotenv.config()

await ensureUploadRoot()

export const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use('/uploads', express.static(getUploadRoot()))
app.use('/api', apiRouter)

app.use((error, req, res, next) => {
  if (error?.message) {
    res.status(400).json({
      code: 400,
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
    message: `接口不存在：${req.method} ${req.path}`,
    data: null,
  })
})
