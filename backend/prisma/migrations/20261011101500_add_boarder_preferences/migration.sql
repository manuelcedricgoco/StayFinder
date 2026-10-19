CREATE TABLE "boarder_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boarderId" TEXT NOT NULL,
    "preferredLocationId" TEXT,
    "minBudget" INTEGER,
    "maxBudget" INTEGER,
    "propertyType" TEXT,
    "occupants" INTEGER,
    "notifyInquiryReplies" BOOLEAN NOT NULL DEFAULT true,
    "notifyFavoriteUpdates" BOOLEAN NOT NULL DEFAULT true,
    "notifyListingUpdates" BOOLEAN NOT NULL DEFAULT true,
    "notifyReviewUpdates" BOOLEAN NOT NULL DEFAULT true,
    "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "boarder_preferences_boarderId_fkey" FOREIGN KEY ("boarderId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "boarder_preferences_preferredLocationId_fkey" FOREIGN KEY ("preferredLocationId") REFERENCES "locations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "boarder_preferences_boarderId_key" ON "boarder_preferences"("boarderId");
CREATE INDEX "boarder_preferences_preferredLocationId_idx" ON "boarder_preferences"("preferredLocationId");

CREATE TABLE "boarder_preference_amenities" (
    "boarderPreferencesId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,
    CONSTRAINT "boarder_preference_amenities_boarderPreferencesId_fkey" FOREIGN KEY ("boarderPreferencesId") REFERENCES "boarder_preferences" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "boarder_preference_amenities_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "amenities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("boarderPreferencesId", "amenityId")
);

CREATE INDEX "boarder_preference_amenities_amenityId_idx" ON "boarder_preference_amenities"("amenityId");
