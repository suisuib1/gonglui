import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { removeStoredFile } from './fileStorage.js'
import { deleteRouteAndUploads } from './routeDeletion.service.js'

const route = {
  id: 'route-1',
  places: [
    {
      id: 'place-1',
      images: [
        { id: 'image-1', storageKey: 'place-1/a.webp', imageUrl: '/uploads/place-1/a.webp' },
        { id: 'image-2', storageKey: 'place-1/missing.webp', imageUrl: '/uploads/place-1/missing.webp' },
      ],
    },
  ],
}

test('deletes the route record after loading associated image records', async () => {
  const calls = []
  const db = mockDb(route, calls)

  const result = await deleteRouteAndUploads('route-1', {
    db,
    removeFile: async () => {},
  })

  assert.deepEqual(result, { id: 'route-1' })
  assert.equal(calls[0].method, 'findUnique')
  assert.equal(calls[1].method, 'delete')
  assert.deepEqual(calls[0].args.include.places.include.images.select, {
    id: true,
    storageKey: true,
    imageUrl: true,
  })
})

test('calls local file deletion for each image attached to the deleted route', async () => {
  const removed = []

  await deleteRouteAndUploads('route-1', {
    db: mockDb(route),
    removeFile: async (storageKey) => {
      removed.push(storageKey)
    },
  })

  assert.deepEqual(removed, ['place-1/a.webp', 'place-1/missing.webp'])
})

test('keeps route deletion successful when an image file is already missing', async () => {
  const warnings = []

  const result = await deleteRouteAndUploads('route-1', {
    db: mockDb(route),
    removeFile: async (storageKey) => {
      if (storageKey.includes('missing')) {
        const error = new Error('missing')
        error.code = 'ENOENT'
        throw error
      }
    },
    logger: {
      warn: (message, meta) => warnings.push({ message, meta }),
    },
  })

  assert.deepEqual(result, { id: 'route-1' })
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].meta.errorCode, 'ENOENT')
})

test('does not delete files outside uploads when storageKey attempts path traversal', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gonglui-route-delete-'))
  const uploadRoot = path.join(tempRoot, 'uploads')
  const outsideFile = path.join(tempRoot, 'outside.txt')
  const originalUploadDir = process.env.UPLOAD_DIR
  process.env.UPLOAD_DIR = uploadRoot

  try {
    await fs.mkdir(uploadRoot, { recursive: true })
    await fs.writeFile(outsideFile, 'keep me')

    const result = await deleteRouteAndUploads('route-1', {
      db: mockDb({
        id: 'route-1',
        places: [{ id: 'place-1', images: [{ id: 'image-1', storageKey: '../outside.txt', imageUrl: '/uploads/../outside.txt' }] }],
      }),
      removeFile: removeStoredFile,
      logger: { warn: () => {} },
    })

    assert.deepEqual(result, { id: 'route-1' })
    assert.equal(await fs.readFile(outsideFile, 'utf8'), 'keep me')
  } finally {
    if (originalUploadDir === undefined) {
      delete process.env.UPLOAD_DIR
    } else {
      process.env.UPLOAD_DIR = originalUploadDir
    }
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('does not delete images attached to another route', async () => {
  const removed = []

  await deleteRouteAndUploads('route-1', {
    db: mockDb({
      id: 'route-1',
      places: [{ id: 'place-1', images: [{ id: 'image-1', storageKey: 'place-1/a.webp' }] }],
    }),
    removeFile: async (storageKey) => {
      removed.push(storageKey)
    },
  })

  assert.deepEqual(removed, ['place-1/a.webp'])
  assert.equal(removed.includes('place-2/other-route.webp'), false)
})

test('deletes route with saved planned segments without touching route snapshot data', async () => {
  const calls = []

  const result = await deleteRouteAndUploads('route-1', {
    db: mockDb(
      {
        id: 'route-1',
        plannedSegments: [{ path: [[120, 30]] }],
        places: [],
      },
      calls,
    ),
    removeFile: async () => {
      throw new Error('should not remove files when there are no images')
    },
  })

  assert.deepEqual(result, { id: 'route-1' })
  assert.equal(calls[0].method, 'findUnique')
  assert.equal(calls[1].method, 'delete')
})

function mockDb(routeValue, calls = []) {
  return {
    route: {
      async findUnique(args) {
        calls.push({ method: 'findUnique', args })
        return routeValue
      },
      async delete(args) {
        calls.push({ method: 'delete', args })
        return { id: args.where.id }
      },
    },
  }
}
