-- CreateTable
CREATE TABLE "ServiceArea" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceArea_agencyId_city_idx" ON "ServiceArea"("agencyId", "city");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceArea_agencyId_postalCode_key" ON "ServiceArea"("agencyId", "postalCode");

-- AddForeignKey
ALTER TABLE "ServiceArea" ADD CONSTRAINT "ServiceArea_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "CourierAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
