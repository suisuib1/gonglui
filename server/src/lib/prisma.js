import { PrismaClient } from '@prisma/client'

const defaultPrisma = new PrismaClient()

export let prisma = defaultPrisma

export function setPrismaClientForTests(client) {
  prisma = client
}

export function resetPrismaClientForTests() {
  prisma = defaultPrisma
}
