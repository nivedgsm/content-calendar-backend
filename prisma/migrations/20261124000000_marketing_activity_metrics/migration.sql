ALTER TABLE "marketing_activities"
ADD COLUMN "totalImpressions" INTEGER,
ADD COLUMN "totalReach" INTEGER,
ADD COLUMN "totalResult" TEXT,
ADD COLUMN "costPerResult" DECIMAL(12,2);
