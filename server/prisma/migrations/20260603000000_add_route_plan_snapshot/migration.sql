ALTER TABLE "Route"
ADD COLUMN "plannedTravelMode" TEXT,
ADD COLUMN "plannedSegments" JSONB,
ADD COLUMN "plannedSummary" JSONB,
ADD COLUMN "plannedAt" TIMESTAMP(3);
