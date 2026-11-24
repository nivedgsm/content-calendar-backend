CREATE TABLE "marketing_activity_images" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imagePublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_activity_images_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketing_activity_images_activityId_fkey" FOREIGN KEY ("activityId")
        REFERENCES "marketing_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "marketing_activity_images_activityId_idx" ON "marketing_activity_images"("activityId");
CREATE UNIQUE INDEX "marketing_activity_images_activityId_imagePublicId_key"
ON "marketing_activity_images"("activityId", "imagePublicId");

ALTER TABLE public.marketing_activity_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct client role access" ON public.marketing_activity_images
FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
