-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('CUSTOMER', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "AgencyRole" AS ENUM ('AGENCY_ADMIN', 'DISPATCHER', 'DELIVERY_WORKER');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierAgency" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierAgency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyUser" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "role" "AgencyRole" NOT NULL DEFAULT 'DELIVERY_WORKER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CourierAgency_slug_key" ON "CourierAgency"("slug");

-- CreateIndex
CREATE INDEX "AgencyUser_agencyId_role_idx" ON "AgencyUser"("agencyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyUser_userId_agencyId_key" ON "AgencyUser"("userId", "agencyId");

-- AddForeignKey
ALTER TABLE "AgencyUser" ADD CONSTRAINT "AgencyUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyUser" ADD CONSTRAINT "AgencyUser_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "CourierAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
