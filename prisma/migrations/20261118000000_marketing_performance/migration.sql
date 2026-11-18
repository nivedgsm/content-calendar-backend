CREATE TABLE "marketing_activities" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "creativeName" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'META',
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "spendRupees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "takenDownAt" TIMESTAMP(3),
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_activities_clientId_uploadedAt_idx"
ON "marketing_activities"("clientId", "uploadedAt");

CREATE INDEX "marketing_activities_takenDownAt_idx"
ON "marketing_activities"("takenDownAt");

ALTER TABLE "marketing_activities"
ADD CONSTRAINT "marketing_activities_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.marketing_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct client role access" ON public.marketing_activities
FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
