import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createApp } from './app.js'
import { resetPrismaClientForTests, setPrismaClientForTests } from './lib/prisma.js'
import { hashPassword, issueAuthToken } from './services/auth.service.js'

const USER1_ROUTE_ID = 'crouteuser100000000000'
const USER2_ROUTE_ID = 'crouteuser200000000000'
const LEGACY_ROUTE_ID = 'croutelegacy000000000'
const SHARED_ROUTE_ID = 'crouteshared000000000'
const USER1_PLACE_ID = 'cplaceuser100000000000'
const USER2_PLACE_ID = 'cplaceuser200000000000'
const USER1_IMAGE_ID = 'cimageuser100000000000'
const USER2_IMAGE_ID = 'cimageuser200000000000'

test('POST /api/auth/login returns a token and current user for valid credentials', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await postJson(`${baseUrl}/api/auth/login`, {
      email: 'user1@example.com',
      password: 'secret-1',
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.success, true)
    assert.equal(payload.code, 0)
    assert.equal(typeof payload.data.token, 'string')
    assert.match(payload.data.expiresAt, /^\d{4}-\d{2}-\d{2}T/)
    assert.deepEqual(payload.data.user, {
      id: 'user-1',
      email: 'user1@example.com',
      displayName: 'User One',
      role: 'user',
      status: 'active',
    })
  })
})

test('POST /api/auth/login rejects wrong passwords and disabled users', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const badPassword = await postJson(`${baseUrl}/api/auth/login`, {
      email: 'user1@example.com',
      password: 'wrong',
    })
    const badPasswordPayload = await badPassword.json()

    assert.equal(badPassword.status, 401)
    assert.equal(badPasswordPayload.success, false)
    assert.equal(badPasswordPayload.code, 'AUTH_INVALID_CREDENTIALS')

    const disabled = await postJson(`${baseUrl}/api/auth/login`, {
      email: 'disabled@example.com',
      password: 'disabled-secret',
    })
    const disabledPayload = await disabled.json()

    assert.equal(disabled.status, 403)
    assert.equal(disabledPayload.success, false)
    assert.equal(disabledPayload.code, 'AUTH_USER_DISABLED')
  })
})

test('route APIs require valid bearer tokens', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const noToken = await fetch(`${baseUrl}/api/routes`)
    assert.equal(noToken.status, 401)

    const fakeToken = await fetch(`${baseUrl}/api/routes`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
    })
    assert.equal(fakeToken.status, 401)
  })
})

test('POST /api/routes binds created routes to the authenticated user', async () => {
  await withTestServer(async ({ baseUrl, tokens, db }) => {
    const response = await postJson(
      `${baseUrl}/api/routes`,
      {
        title: 'User 1 new route',
        city: '杭州',
        travelMode: 'polyline',
        places: [
          { name: '西湖', lng: 120.1, lat: 30.2 },
          { name: '灵隐寺', lng: 120.12, lat: 30.24 },
        ],
      },
      tokens.user1,
    )
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.code, 0)
    assert.equal(db.state.routes.at(-1).userId, 'user-1')
  })
})

test('POST /api/routes returns validation errors after authentication succeeds', async () => {
  await withTestServer(async ({ baseUrl, tokens }) => {
    const response = await postJson(
      `${baseUrl}/api/routes`,
      {
        title: '',
        city: '杭州',
        travelMode: 'polyline',
        places: [],
      },
      tokens.user1,
    )
    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.equal(payload.success, false)
    assert.equal(payload.code, 'ROUTE_VALIDATION_ERROR')
    assert.equal(payload.message, '路线名称不能为空。')
  })
})

test('route list and details are scoped to owner while admins can access all routes', async () => {
  await withTestServer(async ({ baseUrl, tokens }) => {
    const userList = await getJson(`${baseUrl}/api/routes`, tokens.user1)
    assert.equal(userList.status, 200)
    const userListPayload = await userList.json()
    assert.deepEqual(
      userListPayload.data.map((route) => route.id).sort(),
      [SHARED_ROUTE_ID, USER1_ROUTE_ID].sort(),
    )

    const adminList = await getJson(`${baseUrl}/api/routes`, tokens.admin)
    const adminListPayload = await adminList.json()
    assert.equal(adminList.status, 200)
    assert.deepEqual(
      adminListPayload.data.map((route) => route.id).sort(),
      [LEGACY_ROUTE_ID, SHARED_ROUTE_ID, USER1_ROUTE_ID, USER2_ROUTE_ID].sort(),
    )

    const userOtherRoute = await getJson(`${baseUrl}/api/routes/${USER2_ROUTE_ID}`, tokens.user1)
    assert.equal(userOtherRoute.status, 404)

    const adminOtherRoute = await getJson(`${baseUrl}/api/routes/${USER2_ROUTE_ID}`, tokens.admin)
    assert.equal(adminOtherRoute.status, 200)
  })
})

test('route update and delete enforce owner access while admins can operate across users', async () => {
  await withTestServer(async ({ baseUrl, tokens, db }) => {
    const userUpdate = await putJson(
      `${baseUrl}/api/routes/${USER2_ROUTE_ID}`,
      validRoutePayload('User should not update'),
      tokens.user1,
    )
    assert.equal(userUpdate.status, 404)
    assert.equal(db.state.routes.find((route) => route.id === USER2_ROUTE_ID).title, 'User 2 route')

    const adminUpdate = await putJson(
      `${baseUrl}/api/routes/${USER2_ROUTE_ID}`,
      validRoutePayload('Admin updated route'),
      tokens.admin,
    )
    assert.equal(adminUpdate.status, 200)
    assert.equal(db.state.routes.find((route) => route.id === USER2_ROUTE_ID).title, 'Admin updated route')

    const userDelete = await fetch(`${baseUrl}/api/routes/${USER2_ROUTE_ID}`, {
      method: 'DELETE',
      headers: authHeaders(tokens.user1),
    })
    assert.equal(userDelete.status, 404)
    assert.equal(db.state.routes.some((route) => route.id === USER2_ROUTE_ID), true)

    const adminDelete = await fetch(`${baseUrl}/api/routes/${USER2_ROUTE_ID}`, {
      method: 'DELETE',
      headers: authHeaders(tokens.admin),
    })
    assert.equal(adminDelete.status, 200)
    assert.equal(db.state.routes.some((route) => route.id === USER2_ROUTE_ID), false)
  })
})

test('place images require place owner before multer writes files and store uploadedById', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gonglui-auth-upload-'))

  await withTestServer(
    async ({ baseUrl, tokens, db }) => {
      const deniedForm = new FormData()
      deniedForm.append('image', new Blob(['nope'], { type: 'image/png' }), 'nope.png')
      deniedForm.append('type', 'scenery')

      const denied = await fetch(`${baseUrl}/api/places/${USER2_PLACE_ID}/images`, {
        method: 'POST',
        headers: bearerHeaders(tokens.user1),
        body: deniedForm,
      })
      assert.equal(denied.status, 404)
      assert.equal(await countFiles(tempRoot), 0)

      const allowedForm = new FormData()
      allowedForm.append('image', new Blob(['ok'], { type: 'image/png' }), 'ok.png')
      allowedForm.append('type', 'scenery')

      const allowed = await fetch(`${baseUrl}/api/places/${USER1_PLACE_ID}/images`, {
        method: 'POST',
        headers: bearerHeaders(tokens.user1),
        body: allowedForm,
      })
      assert.equal(allowed.status, 200)
      assert.equal(db.state.images.at(-1).uploadedById, 'user-1')
    },
    { uploadDir: tempRoot },
  )

  await fs.rm(tempRoot, { recursive: true, force: true })
})

test('image deletion requires image owner while admins can delete across users', async () => {
  await withTestServer(async ({ baseUrl, tokens, db }) => {
    const denied = await fetch(`${baseUrl}/api/images/${USER2_IMAGE_ID}`, {
      method: 'DELETE',
      headers: authHeaders(tokens.user1),
    })
    assert.equal(denied.status, 404)
    assert.equal(db.state.images.some((image) => image.id === USER2_IMAGE_ID), true)

    const allowed = await fetch(`${baseUrl}/api/images/${USER2_IMAGE_ID}`, {
      method: 'DELETE',
      headers: authHeaders(tokens.admin),
    })
    assert.equal(allowed.status, 200)
    assert.equal(db.state.images.some((image) => image.id === USER2_IMAGE_ID), false)
  })
})

test('GET /api/share/:token remains anonymously readable', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/share/public-share-token`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.code, 0)
    assert.equal(payload.data.id, SHARED_ROUTE_ID)
  })
})

async function withTestServer(callback, options = {}) {
  const previousEnv = {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    UPLOAD_DIR: process.env.UPLOAD_DIR,
  }

  process.env.JWT_SECRET = 'test-jwt-secret'
  process.env.JWT_EXPIRES_IN = '1h'
  if (options.uploadDir) process.env.UPLOAD_DIR = options.uploadDir

  const db = await createMockPrisma()
  setPrismaClientForTests(db)

  const tokens = {
    admin: issueAuthToken(db.state.users.find((user) => user.id === 'admin-1')).token,
    user1: issueAuthToken(db.state.users.find((user) => user.id === 'user-1')).token,
    user2: issueAuthToken(db.state.users.find((user) => user.id === 'user-2')).token,
  }

  const app = await createApp()
  const server = app.listen(0)

  try {
    const { port } = server.address()
    await callback({ baseUrl: `http://127.0.0.1:${port}`, db, tokens })
  } finally {
    await new Promise((resolve) => server.close(resolve))
    resetPrismaClientForTests()
    restoreEnv(previousEnv)
  }
}

async function createMockPrisma() {
  const now = new Date('2026-06-26T00:00:00.000Z')
  const state = {
    users: [
      {
        id: 'admin-1',
        email: 'admin@example.com',
        passwordHash: await hashPassword('admin-secret'),
        displayName: 'Admin',
        role: 'admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-1',
        email: 'user1@example.com',
        passwordHash: await hashPassword('secret-1'),
        displayName: 'User One',
        role: 'user',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-2',
        email: 'user2@example.com',
        passwordHash: await hashPassword('secret-2'),
        displayName: 'User Two',
        role: 'user',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'disabled-1',
        email: 'disabled@example.com',
        passwordHash: await hashPassword('disabled-secret'),
        displayName: 'Disabled',
        role: 'user',
        status: 'disabled',
        createdAt: now,
        updatedAt: now,
      },
    ],
    routes: [
      routeRecord(USER1_ROUTE_ID, 'User 1 route', 'user-1', now),
      routeRecord(USER2_ROUTE_ID, 'User 2 route', 'user-2', now),
      routeRecord(LEGACY_ROUTE_ID, 'Legacy route', null, now),
      {
        ...routeRecord(SHARED_ROUTE_ID, 'Shared route', 'user-1', now),
        shareToken: 'public-share-token',
        sharedAt: now,
      },
    ],
    places: [
      placeRecord(USER1_PLACE_ID, USER1_ROUTE_ID, '西湖'),
      placeRecord(USER2_PLACE_ID, USER2_ROUTE_ID, '灵隐寺'),
    ],
    images: [
      imageRecord(USER1_IMAGE_ID, USER1_PLACE_ID, 'user-1'),
      imageRecord(USER2_IMAGE_ID, USER2_PLACE_ID, 'user-2'),
    ],
  }

  const db = {
    state,
    user: {
      async findUnique(args) {
        return state.users.find((user) => matchesWhere(user, args.where)) || null
      },
      async create(args) {
        const user = { id: `user-${state.users.length + 1}`, createdAt: now, updatedAt: now, ...args.data }
        state.users.push(user)
        return project(user, args.select)
      },
    },
    route: {
      async create(args) {
        const route = {
          id: `cnewroute${String(state.routes.length + 1).padStart(15, '0')}`,
          shareToken: null,
          sharedAt: null,
          createdAt: now,
          updatedAt: now,
          ...args.data,
        }
        delete route.places
        state.routes.push(route)

        for (const [index, place] of (args.data.places?.create || []).entries()) {
          state.places.push({
            id: `cnewplace${String(state.places.length + 1).padStart(15, '0')}`,
            routeId: route.id,
            createdAt: now,
            updatedAt: now,
            ...place,
            sortOrder: place.sortOrder || index + 1,
          })
        }

        return includeRoute(route, args.include, state)
      },
      async findMany(args = {}) {
        return state.routes
          .filter((route) => matchesWhere(route, args.where || {}))
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((route) => includeRoute(route, args.include, state))
      },
      async findUnique(args) {
        const route = state.routes.find((item) => matchesWhere(item, args.where)) || null
        return includeRoute(route, args.include, state, args.select)
      },
      async findFirst(args) {
        const route = state.routes.find((item) => matchesWhere(item, args.where)) || null
        return includeRoute(route, args.include, state, args.select)
      },
      async update(args) {
        const route = state.routes.find((item) => item.id === args.where.id)
        if (!route) throw prismaNotFound()
        Object.assign(route, args.data, { updatedAt: now })
        return includeRoute(route, args.include, state, args.select)
      },
      async delete(args) {
        const index = state.routes.findIndex((route) => route.id === args.where.id)
        if (index < 0) throw prismaNotFound()
        const [deleted] = state.routes.splice(index, 1)
        state.places = state.places.filter((place) => place.routeId !== deleted.id)
        state.images = state.images.filter((image) => state.places.some((place) => place.id === image.placeId))
        return deleted
      },
      async updateMany(args) {
        let count = 0
        for (const route of state.routes) {
          if (matchesWhere(route, args.where || {})) {
            Object.assign(route, args.data)
            count += 1
          }
        }
        return { count }
      },
    },
    routePlace: {
      async findUnique(args) {
        const place = state.places.find((item) => matchesWhere(item, args.where)) || null
        return includePlace(place, args.include, state)
      },
      async update(args) {
        const place = state.places.find((item) => item.id === args.where.id)
        if (!place) throw prismaNotFound()
        Object.assign(place, args.data, { updatedAt: now })
        return includePlace(place, args.include, state)
      },
      async create(args) {
        const place = { id: `cnewplace${String(state.places.length + 1).padStart(15, '0')}`, createdAt: now, updatedAt: now, ...args.data }
        state.places.push(place)
        return place
      },
      async deleteMany(args) {
        const before = state.places.length
        state.places = state.places.filter((place) => !(place.routeId === args.where.routeId && !args.where.id.notIn.includes(place.id)))
        return { count: before - state.places.length }
      },
    },
    placeImage: {
      async findUnique(args) {
        const image = state.images.find((item) => matchesWhere(item, args.where)) || null
        return includeImage(image, args.include, state)
      },
      async create(args) {
        const image = {
          id: `cnewimage${String(state.images.length + 1).padStart(15, '0')}`,
          createdAt: now,
          ...args.data,
        }
        state.images.push(image)
        return image
      },
      async delete(args) {
        const index = state.images.findIndex((image) => image.id === args.where.id)
        if (index < 0) throw prismaNotFound()
        const [deleted] = state.images.splice(index, 1)
        return deleted
      },
    },
    async $transaction(callback) {
      return callback(db)
    },
  }

  return db
}

function routeRecord(id, title, userId, now) {
  return {
    id,
    title,
    city: '杭州',
    travelMode: 'polyline',
    plannedTravelMode: null,
    plannedSegments: null,
    plannedSummary: null,
    plannedAt: null,
    shareToken: null,
    sharedAt: null,
    userId,
    createdAt: now,
    updatedAt: now,
  }
}

function placeRecord(id, routeId, name) {
  return {
    id,
    routeId,
    name,
    address: '',
    longitude: 120.1,
    latitude: 30.2,
    sortOrder: 1,
    note: '',
    geocodeStatus: 'success',
    amapPoiId: null,
    createdAt: new Date('2026-06-26T00:00:00.000Z'),
    updatedAt: new Date('2026-06-26T00:00:00.000Z'),
  }
}

function imageRecord(id, placeId, uploadedById) {
  return {
    id,
    placeId,
    imageType: 'scenery',
    imageUrl: `/uploads/${placeId}/a.png`,
    storageKey: `${placeId}/a.png`,
    originalName: 'a.png',
    size: 10,
    mimeType: 'image/png',
    uploadedById,
    createdAt: new Date('2026-06-26T00:00:00.000Z'),
  }
}

function includeRoute(route, include, state, select) {
  if (!route) return null
  if (select) return project(route, select)

  const result = { ...route }
  if (include?.places?.select?._count) {
    result.places = state.places
      .filter((place) => place.routeId === route.id)
      .map((place) => ({
        id: place.id,
        _count: {
          images: state.images.filter((image) => image.placeId === place.id).length,
        },
      }))
  } else if (include?.places?.select?.id) {
    result.places = state.places.filter((place) => place.routeId === route.id).map((place) => ({ id: place.id }))
  } else if (include?.places?.include?.images) {
    result.places = state.places
      .filter((place) => place.routeId === route.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((place) => ({
        ...place,
        images: state.images.filter((image) => image.placeId === place.id),
      }))
  }

  return result
}

function includePlace(place, include, state) {
  if (!place) return null
  const result = { ...place }
  if (include?.route) {
    const route = state.routes.find((item) => item.id === place.routeId)
    result.route = include.route.select ? project(route, include.route.select) : route
  }
  return result
}

function includeImage(image, include, state) {
  if (!image) return null
  const result = { ...image }
  if (include?.place) {
    const place = state.places.find((item) => item.id === image.placeId)
    result.place = include.place.include ? includePlace(place, include.place.include, state) : place
  }
  return result
}

function matchesWhere(record, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (value === null) return record[key] === null || record[key] === undefined
    if (typeof value === 'object' && value && 'notIn' in value) return !value.notIn.includes(record[key])
    return record[key] === value
  })
}

function project(record, select = {}) {
  if (!record) return null
  return Object.fromEntries(Object.entries(select).filter(([, include]) => include).map(([key]) => [key, record[key]]))
}

function prismaNotFound() {
  const error = new Error('Record not found')
  error.code = 'P2025'
  return error
}

function validRoutePayload(title) {
  return {
    title,
    city: '杭州',
    travelMode: 'polyline',
    places: [
      { id: USER2_PLACE_ID, name: '灵隐寺', lng: 120.12, lat: 30.24, order: 1 },
      { name: '西溪', lng: 120.08, lat: 30.26, order: 2 },
    ],
  }
}

async function postJson(url, body, token) {
  return fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
}

async function putJson(url, body, token) {
  return fetch(url, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
}

async function getJson(url, token) {
  return fetch(url, {
    headers: authHeaders(token),
  })
}

function authHeaders(token) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  }
}

function bearerHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function countFiles(root) {
  try {
    const entries = await fs.readdir(root, { recursive: true, withFileTypes: true })
    return entries.filter((entry) => entry.isFile()).length
  } catch (error) {
    if (error.code === 'ENOENT') return 0
    throw error
  }
}

function restoreEnv(previousEnv) {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}
