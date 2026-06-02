import { Router } from 'express'
import { deleteImage } from '../controllers/imagesController.js'
import { updatePlaceNote, uploadPlaceImage as uploadPlaceImageController } from '../controllers/placesController.js'
import { createRoute, deleteRoute, getRoute, listRoutes, updateRoute } from '../controllers/routesController.js'
import { uploadPlaceImage, validateUploadPlaceId } from '../middlewares/upload.js'

export const apiRouter = Router()

apiRouter.post('/routes', createRoute)
apiRouter.get('/routes', listRoutes)
apiRouter.get('/routes/:id', getRoute)
apiRouter.put('/routes/:id', updateRoute)
apiRouter.delete('/routes/:id', deleteRoute)
apiRouter.patch('/places/:id/note', updatePlaceNote)
apiRouter.post('/places/:id/images', validateUploadPlaceId, uploadPlaceImage.single('image'), uploadPlaceImageController)
apiRouter.delete('/images/:id', deleteImage)
