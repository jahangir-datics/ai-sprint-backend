-- AlterTable: Add new columns to AuditLog
ALTER TABLE "AuditLog" ADD COLUMN "method" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "path" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "requestBody" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "responseBody" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Add new columns to Activity
ALTER TABLE "Activity" ADD COLUMN "resource" TEXT;
ALTER TABLE "Activity" ADD COLUMN "resourceId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_statusCode_idx" ON "AuditLog"("statusCode");
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");
