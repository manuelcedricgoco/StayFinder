ALTER TABLE "sessions" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "sessions" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "sessions" ADD COLUMN "lastActivityAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';
UPDATE "sessions" SET "lastActivityAt" = "createdAt";

CREATE TABLE "security_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userName" TEXT,
    "email" TEXT,
    "role" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "security_events_createdAt_idx" ON "security_events"("createdAt");
CREATE INDEX "security_events_action_createdAt_idx" ON "security_events"("action", "createdAt");
CREATE INDEX "security_events_userId_createdAt_idx" ON "security_events"("userId", "createdAt");
CREATE INDEX "security_events_ipAddress_createdAt_idx" ON "security_events"("ipAddress", "createdAt");
