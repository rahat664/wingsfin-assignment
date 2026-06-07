-- CreateEnum
CREATE TYPE "InstrumentType" AS ENUM ('INDEX', 'STOCK');

-- CreateTable
CREATE TABLE "MarketTick" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "instrumentType" "InstrumentType" NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "yesterdayClose" DECIMAL(18,4) NOT NULL,
    "changePercent" DECIMAL(10,4),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketTick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketTick_symbol_instrumentType_eventTime_idx" ON "MarketTick"("symbol", "instrumentType", "eventTime");

-- CreateIndex
CREATE INDEX "MarketTick_eventTime_idx" ON "MarketTick"("eventTime");
