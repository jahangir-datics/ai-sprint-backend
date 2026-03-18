-- AlterTable: Add new columns to FeatureFlag
ALTER TABLE "FeatureFlag" ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'production';
ALTER TABLE "FeatureFlag" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "FeatureFlag" ADD COLUMN "updatedBy" TEXT;

-- CreateIndex
CREATE INDEX "FeatureFlag_environment_idx" ON "FeatureFlag"("environment");
