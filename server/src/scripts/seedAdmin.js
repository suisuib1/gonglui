import dotenv from 'dotenv'
import { prisma } from '../lib/prisma.js'
import { hashPassword, normalizeEmail } from '../services/auth.service.js'

dotenv.config()

async function main() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL)
  const password = String(process.env.ADMIN_PASSWORD || '')
  const displayName = String(process.env.ADMIN_DISPLAY_NAME || 'Admin').trim() || 'Admin'

  if (!email) throw new Error('ADMIN_EMAIL is required')
  if (!password) throw new Error('ADMIN_PASSWORD is required')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Admin user already exists: ${email}`)
    return
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      displayName,
      role: 'admin',
      status: 'active',
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
    },
  })

  console.log(`Admin user created: ${user.email} (${user.id})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect?.()
  })
