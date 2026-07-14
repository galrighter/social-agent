-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowHash" TEXT NOT NULL,
    "playerKey" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "phone" TEXT,
    "type" TEXT NOT NULL,
    "rawAmount" REAL NOT NULL,
    "effectiveAmount" REAL NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "rawDateText" TEXT,
    "notes" TEXT,
    "sourceFileName" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "excludedFromStats" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRows" INTEGER NOT NULL,
    "insertedRows" INTEGER NOT NULL,
    "skippedDuplicateRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "correctionRows" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "DataCorrection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "matchPlayerName" TEXT,
    "matchPhone" TEXT,
    "matchType" TEXT,
    "matchOccurredAt" TEXT,
    "matchRawAmount" REAL,
    "effectiveAmount" REAL,
    "excludeFromStats" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_rowHash_key" ON "Transaction"("rowHash");

-- CreateIndex
CREATE INDEX "Transaction_occurredAt_idx" ON "Transaction"("occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_playerKey_idx" ON "Transaction"("playerKey");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE UNIQUE INDEX "DataCorrection_name_key" ON "DataCorrection"("name");
