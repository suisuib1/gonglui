-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "travelMode" TEXT NOT NULL DEFAULT 'polyline',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutePlace" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL,
    "note" TEXT,
    "geocodeStatus" TEXT NOT NULL DEFAULT 'pending',
    "amapPoiId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutePlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceImage" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "imageType" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoutePlace_routeId_sortOrder_idx" ON "RoutePlace"("routeId", "sortOrder");

-- CreateIndex
CREATE INDEX "PlaceImage_placeId_createdAt_idx" ON "PlaceImage"("placeId", "createdAt");

-- AddForeignKey
ALTER TABLE "RoutePlace" ADD CONSTRAINT "RoutePlace_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceImage" ADD CONSTRAINT "PlaceImage_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "RoutePlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
