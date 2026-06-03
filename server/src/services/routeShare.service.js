import { randomBytes as defaultRandomBytes } from 'node:crypto'
import { serializeSharedRoute } from './routePayload.js'

const SHARE_TOKEN_BYTES = 24
const MAX_TOKEN_ATTEMPTS = 3

export async function ensureRouteShare(prisma, routeId, options = {}) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    select: {
      id: true,
      shareToken: true,
      sharedAt: true,
    },
  })

  if (!route) return null
  if (route.shareToken) return buildSharePayload(route.shareToken)

  const randomBytes = options.randomBytes || defaultRandomBytes

  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt += 1) {
    const shareToken = createShareToken(randomBytes)

    try {
      const updated = await prisma.route.update({
        where: { id: routeId },
        data: {
          shareToken,
          sharedAt: new Date(),
        },
        select: {
          shareToken: true,
        },
      })

      return buildSharePayload(updated.shareToken)
    } catch (error) {
      if (error.code !== 'P2002' || attempt === MAX_TOKEN_ATTEMPTS - 1) throw error
    }
  }

  return null
}

export async function getSharedRouteByToken(prisma, token, routeInclude) {
  const shareToken = String(token || '').trim()
  if (!shareToken) return null

  const route = await prisma.route.findUnique({
    where: { shareToken },
    include: routeInclude,
  })

  return route ? serializeSharedRoute(route) : null
}

function createShareToken(randomBytes) {
  return randomBytes(SHARE_TOKEN_BYTES).toString('base64url')
}

function buildSharePayload(shareToken) {
  return {
    shareToken,
    shareUrl: `/share/${shareToken}`,
  }
}
