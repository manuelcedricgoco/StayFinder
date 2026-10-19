CREATE TABLE "payment_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT,
    "boarderName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_records_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_records_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "payment_records_propertyId_paymentDate_idx" ON "payment_records"("propertyId", "paymentDate");
CREATE INDEX "payment_records_propertyId_status_idx" ON "payment_records"("propertyId", "status");
CREATE INDEX "payment_records_roomId_idx" ON "payment_records"("roomId");
