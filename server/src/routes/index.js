import { Router } from 'express'
import { login, me } from '../controllers/authController.js'
import { deleteImage } from '../controllers/imagesController.js'
import { updatePlaceNote, uploadPlaceImage as uploadPlaceImageController } from '../controllers/placesController.js'
import { deleteRoute } from '../controllers/routeDeleteController.js'
import { optimizeRouteController } from '../controllers/routeOptimizeController.js'
import { planRouteController } from '../controllers/routePlanController.js'
import { createRoute, getRoute, listRoutes, updateRoute } from '../controllers/routesController.js'
import { createRouteShare, getSharedRoute } from '../controllers/shareController.js'
import { requireAuth, requireImageOwner, requirePlaceOwner } from '../middlewares/auth.js'
import { uploadPlaceImage, validateUploadPlaceId } from '../middlewares/upload.js'

export const apiRouter = Router()

apiRouter.get('/health', (req, res) => {
  res.json({
    code: 0,
    message: 'ok',
    data: {
      status: 'ok',
      time: new Date().toISOString(),
    },
  })
})

apiRouter.post('/auth/login', login)
apiRouter.get('/auth/me', requireAuth(), me)
apiRouter.post('/routes', requireAuth(), createRoute)
apiRouter.post('/routes/optimize', requireAuth(), optimizeRouteController)
apiRouter.post('/routes/plan', requireAuth(), planRouteController)
apiRouter.get('/routes', requireAuth(), listRoutes)
apiRouter.post('/routes/:id/share', requireAuth(), createRouteShare)
apiRouter.get('/routes/:id', requireAuth(), getRoute)
apiRouter.put('/routes/:id', requireAuth(), updateRoute)
apiRouter.delete('/routes/:id', requireAuth(), deleteRoute)
apiRouter.get('/share/:token', getSharedRoute)
apiRouter.patch('/places/:id/note', requireAuth(), requirePlaceOwner(), updatePlaceNote)
apiRouter.post('/places/:id/images', requireAuth(), validateUploadPlaceId, requirePlaceOwner(), uploadPlaceImage.single('image'), uploadPlaceImageController)
apiRouter.delete('/images/:id', requireAuth(), requireImageOwner(), deleteImage)
