CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "siteName" TEXT NOT NULL DEFAULT 'StayFinder',
    "allowRegistrations" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveListings" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
