import { authenticateUser } from '../services/auth.service.js'

export async function login(req, res) {
  const data = await authenticateUser(req.body)
  res.json(ok(data))
}

export async function me(req, res) {
  res.json(ok({ user: req.user }))
}

function ok(data) {
  return {
    success: true,
    code: 0,
    message: 'ok',
    data,
  }
}
