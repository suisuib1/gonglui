import dotenv from 'dotenv'
import { prisma } from '../lib/prisma.js'
import { normalizeEmail } from '../services/auth.service.js'

dotenv.config()

async function main() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL)
  if (!email) throw new Error('ADMIN_EMAIL is required')

  const admin = await prisma.user.findUnique({ where: { email } })
  if (!admin) {
    throw new Error(`Admin user not found for ${email}. Run npm run seed:admin first.`)
  }

  if (admin.role !== 'admin') {
    throw new Error(`${email} is not an admin user`)
  }

  const result = await prisma.route.updateMany({
    where: {
      userId: null,
    },
    data: {
      userId: admin.id,
    },
  })

  console.log(`Backfilled ${result.count} routes to admin ${admin.email} (${admin.id})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect?.()
  })
