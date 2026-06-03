-- Add nullable share fields so existing routes remain private until shared.
ALTER TABLE "Route"
ADD COLUMN "shareToken" TEXT,
ADD COLUMN "sharedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Route_shareToken_key" ON "Route"("shareToken");
