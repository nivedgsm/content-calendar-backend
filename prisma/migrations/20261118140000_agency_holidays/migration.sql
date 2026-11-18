CREATE TABLE "agency_holidays" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_holidays_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agency_holidays_agencyId_date_idx"
ON "agency_holidays"("agencyId", "date");

ALTER TABLE "agency_holidays"
ADD CONSTRAINT "agency_holidays_agencyId_fkey"
FOREIGN KEY ("agencyId") REFERENCES "Agency"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.agency_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct client role access" ON public.agency_holidays
FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
