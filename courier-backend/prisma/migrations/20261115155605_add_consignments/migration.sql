-- CreateEnum
CREATE TYPE "ConsignmentStatus" AS ENUM ('CREATED', 'CONFIRMED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED_DELIVERY');

-- CreateTable
CREATE TABLE "Consignment" (
    "id" UUID NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "senderPostalCode" TEXT NOT NULL,
    "receiverName" TEXT NOT NULL,
    "receiverPhone" TEXT NOT NULL,
    "receiverAddress" TEXT NOT NULL,
    "receiverPostalCode" TEXT NOT NULL,
    "packageDescription" TEXT NOT NULL,
    "packageWeight" DECIMAL(8,3) NOT NULL,
    "status" "ConsignmentStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsignmentStatusHistory" (
    "id" UUID NOT NULL,
    "consignmentId" UUID NOT NULL,
    "fromStatus" "ConsignmentStatus",
    "toStatus" "ConsignmentStatus" NOT NULL,
    "changedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsignmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Consignment_trackingNumber_key" ON "Consignment"("trackingNumber");

-- CreateIndex
CREATE INDEX "Consignment_customerId_createdAt_idx" ON "Consignment"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Consignment_agencyId_status_createdAt_idx" ON "Consignment"("agencyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ConsignmentStatusHistory_consignmentId_createdAt_idx" ON "ConsignmentStatusHistory"("consignmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "CourierAgency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignmentStatusHistory" ADD CONSTRAINT "ConsignmentStatusHistory_consignmentId_fkey" FOREIGN KEY ("consignmentId") REFERENCES "Consignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignmentStatusHistory" ADD CONSTRAINT "ConsignmentStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
