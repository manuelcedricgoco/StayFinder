ALTER TABLE "users" ADD COLUMN "phoneNumber" TEXT;

CREATE TABLE "owner_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "defaultPropertyId" TEXT,
    "notifyNewInquiry" BOOLEAN NOT NULL DEFAULT true,
    "notifyNewReview" BOOLEAN NOT NULL DEFAULT true,
    "notifyListingStatus" BOOLEAN NOT NULL DEFAULT true,
    "notifyVerification" BOOLEAN NOT NULL DEFAULT true,
    "notifyPayment" BOOLEAN NOT NULL DEFAULT true,
    "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "owner_preferences_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "owner_preferences_defaultPropertyId_fkey" FOREIGN KEY ("defaultPropertyId") REFERENCES "properties" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "owner_preferences_ownerId_key" ON "owner_preferences"("ownerId");
CREATE INDEX "owner_preferences_defaultPropertyId_idx" ON "owner_preferences"("defaultPropertyId");
