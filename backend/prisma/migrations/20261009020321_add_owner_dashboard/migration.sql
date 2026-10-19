-- CreateTable
CREATE TABLE "owner_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "additionalInfo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "owner_verifications_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "owner_verifications_ownerId_key" ON "owner_verifications"("ownerId");

-- CreateIndex
CREATE INDEX "owner_verifications_status_submittedAt_idx" ON "owner_verifications"("status", "submittedAt");
