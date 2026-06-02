import { Router } from 'express'
import { deleteImage } from '../controllers/imagesController.js'
import { updatePlaceNote, uploadPlaceImage as uploadPlaceImageController } from '../controllers/placesController.js'
import { optimizeRouteController } from '../controllers/routeOptimizeController.js'
import { planRouteController } from '../controllers/routePlanController.js'
import { createRoute, deleteRoute, getRoute, listRoutes, updateRoute } from '../controllers/routesController.js'
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

apiRouter.post('/routes', createRoute)
apiRouter.post('/routes/optimize', optimizeRouteController)
apiRouter.post('/routes/plan', planRouteController)
apiRouter.get('/routes', listRoutes)
apiRouter.get('/routes/:id', getRoute)
apiRouter.put('/routes/:id', updateRoute)
apiRouter.delete('/routes/:id', deleteRoute)
apiRouter.patch('/places/:id/note', updatePlaceNote)
apiRouter.post('/places/:id/images', validateUploadPlaceId, uploadPlaceImage.single('image'), uploadPlaceImageController)
apiRouter.delete('/images/:id', deleteImage)
