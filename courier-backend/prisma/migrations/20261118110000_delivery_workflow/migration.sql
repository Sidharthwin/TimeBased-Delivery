CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "BookingHistoryAction" AS ENUM ('CREATED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED');
CREATE TYPE "DeliveryAttemptStatus" AS ENUM ('SUCCESSFUL', 'FAILED');

CREATE TABLE "DeliverySlot" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TIME(0) WITHOUT TIME ZONE NOT NULL,
    "endTime" TIME(0) WITHOUT TIME ZONE NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliverySlot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeliverySlot_valid_window" CHECK ("startTime" < "endTime"),
    CONSTRAINT "DeliverySlot_positive_capacity" CHECK ("capacity" > 0)
);

CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "consignmentId" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "slotDate" DATE NOT NULL,
    "slotStartTime" TIME(0) WITHOUT TIME ZONE NOT NULL,
    "slotEndTime" TIME(0) WITHOUT TIME ZONE NOT NULL,
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingHistory" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "action" "BookingHistoryAction" NOT NULL,
    "fromSlotDate" DATE,
    "fromStartTime" TIME(0) WITHOUT TIME ZONE,
    "fromEndTime" TIME(0) WITHOUT TIME ZONE,
    "toSlotDate" DATE,
    "toStartTime" TIME(0) WITHOUT TIME ZONE,
    "toEndTime" TIME(0) WITHOUT TIME ZONE,
    "changedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryAssignment" (
    "id" UUID NOT NULL,
    "consignmentId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "assignedById" UUID,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryAttempt" (
    "id" UUID NOT NULL,
    "consignmentId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "status" "DeliveryAttemptStatus" NOT NULL,
    "failureReason" TEXT,
    "notes" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeliveryAttempt_failure_reason" CHECK (
      ("status" = 'FAILED' AND "failureReason" IS NOT NULL AND length(trim("failureReason")) > 0)
      OR ("status" = 'SUCCESSFUL' AND "failureReason" IS NULL)
    )
);

CREATE UNIQUE INDEX "DeliverySlot_agencyId_date_startTime_endTime_key" ON "DeliverySlot"("agencyId", "date", "startTime", "endTime");
CREATE INDEX "DeliverySlot_agencyId_date_isActive_idx" ON "DeliverySlot"("agencyId", "date", "isActive");
CREATE INDEX "Booking_customerId_status_createdAt_idx" ON "Booking"("customerId", "status", "createdAt");
CREATE INDEX "Booking_agencyId_slotDate_status_idx" ON "Booking"("agencyId", "slotDate", "status");
CREATE INDEX "Booking_slotId_status_idx" ON "Booking"("slotId", "status");
CREATE INDEX "Booking_consignmentId_status_idx" ON "Booking"("consignmentId", "status");
CREATE UNIQUE INDEX "Booking_one_confirmed_per_consignment_key" ON "Booking"("consignmentId") WHERE "status" = 'CONFIRMED';
CREATE INDEX "BookingHistory_bookingId_createdAt_idx" ON "BookingHistory"("bookingId", "createdAt");
CREATE INDEX "DeliveryAssignment_agencyId_isActive_assignedAt_idx" ON "DeliveryAssignment"("agencyId", "isActive", "assignedAt");
CREATE INDEX "DeliveryAssignment_employeeId_isActive_assignedAt_idx" ON "DeliveryAssignment"("employeeId", "isActive", "assignedAt");
CREATE INDEX "DeliveryAssignment_consignmentId_isActive_idx" ON "DeliveryAssignment"("consignmentId", "isActive");
CREATE UNIQUE INDEX "DeliveryAssignment_one_active_per_consignment_key" ON "DeliveryAssignment"("consignmentId") WHERE "isActive" = TRUE;
CREATE INDEX "DeliveryAttempt_consignmentId_attemptedAt_idx" ON "DeliveryAttempt"("consignmentId", "attemptedAt");
CREATE INDEX "DeliveryAttempt_workerId_attemptedAt_idx" ON "DeliveryAttempt"("workerId", "attemptedAt");
CREATE INDEX "DeliveryAttempt_assignmentId_attemptedAt_idx" ON "DeliveryAttempt"("assignmentId", "attemptedAt");

-- The application also serializes slot writes by locking the agency row. This database
-- exclusion constraint protects against overlapping slots from any writer.
ALTER TABLE "DeliverySlot" ADD CONSTRAINT "DeliverySlot_no_overlap"
  EXCLUDE USING gist (
    "agencyId" WITH =,
    "date" WITH =,
    (tsrange("date" + "startTime", "date" + "endTime", '[)')) WITH &&
  );

ALTER TABLE "DeliverySlot" ADD CONSTRAINT "DeliverySlot_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "CourierAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_consignmentId_fkey"
  FOREIGN KEY ("consignmentId") REFERENCES "Consignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_slotId_fkey"
  FOREIGN KEY ("slotId") REFERENCES "DeliverySlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "CourierAgency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingHistory" ADD CONSTRAINT "BookingHistory_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingHistory" ADD CONSTRAINT "BookingHistory_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_consignmentId_fkey"
  FOREIGN KEY ("consignmentId") REFERENCES "Consignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "CourierAgency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_consignmentId_fkey"
  FOREIGN KEY ("consignmentId") REFERENCES "Consignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "DeliveryAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
