ALTER TABLE "marketing_activities"
ADD COLUMN "location" TEXT,
ADD COLUMN "showDailySpendToClient" BOOLEAN NOT NULL DEFAULT TRUE;
