import prisma from "../../config/database.js";
import {
  CONSIGNMENT_TERMINAL_STATUSES, dateOnly, dayBounds, fail, isDatabaseConflict, isUuid,
  lockBooking, lockConsignment, lockSlot, sendControllerError, VALID_CONSIGNMENT_TRANSITIONS,
} from "./shared.js";

const deliverySelect = {
  id: true,
  trackingNumber: true,
  status: true,
  senderName: true,
  senderPhone: true,
  senderAddress: true,
  senderPostalCode: true,
  receiverName: true,
  receiverPhone: true,
  receiverAddress: true,
  receiverPostalCode: true,
  packageDescription: true,
  packageWeight: true,
  updatedAt: true,
};

const attemptInclude = {
  worker: { select: { id: true, name: true } },
  consignment: { select: { trackingNumber: true, status: true, agencyId: true } },
};

async function assertWorkerAssignment(tx, consignmentId, workerId, agencyId) {
  const assignment = await tx.deliveryAssignment.findFirst({
    where: { consignmentId, employeeId: workerId, agencyId, isActive: true },
    select: { id: true, agencyId: true },
  });
  if (!assignment) fail(404, "No active assignment found for this consignment");
  return assignment;
}

async function writeStatus(tx, consignment, status, workerId) {
  await tx.consignment.update({ where: { id: consignment.id }, data: { status } });
  await tx.consignmentStatusHistory.create({
    data: { consignmentId: consignment.id, fromStatus: consignment.status, toStatus: status, changedById: workerId },
  });
  consignment.status = status;
}

async function completeBooking(tx, consignmentId, workerId) {
  const booking = await tx.booking.findFirst({ where: { consignmentId, status: "CONFIRMED" }, select: { id: true, slotId: true } });
  if (!booking) return;
  if (!await lockBooking(tx, booking.id) || !await lockSlot(tx, booking.slotId)) fail(409, "Booking changed while delivery was being completed");
  const current = await tx.booking.findUnique({ where: { id: booking.id } });
  const completed = await tx.booking.update({ where: { id: booking.id }, data: { status: "COMPLETED" } });
  await tx.bookingHistory.create({
    data: {
      bookingId: completed.id,
      action: "COMPLETED",
      fromSlotDate: current.slotDate,
      fromStartTime: current.slotStartTime,
      fromEndTime: current.slotEndTime,
      toSlotDate: current.slotDate,
      toStartTime: current.slotStartTime,
      toEndTime: current.slotEndTime,
      changedById: workerId,
    },
  });
}

export async function listWorkerConsignments(req, res, next) {
  try {
    const assignments = await prisma.deliveryAssignment.findMany({
      where: { employeeId: req.user.userId, agencyId: req.agency.id, isActive: true },
      orderBy: { assignedAt: "desc" },
      include: { consignment: { select: deliverySelect } },
    });
    return res.status(200).json({ success: true, data: assignments.map((row) => ({ assignmentId: row.id, assignedAt: row.assignedAt, consignment: row.consignment })) });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}

export async function getWorkerConsignment(req, res, next) {
  try {
    if (!isUuid(req.params.id)) fail(404, "Consignment not found");
    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { consignmentId: req.params.id, employeeId: req.user.userId, agencyId: req.agency.id, isActive: true },
      include: { consignment: { select: { ...deliverySelect, statusHistory: { orderBy: { createdAt: "asc" }, select: { fromStatus: true, toStatus: true, createdAt: true } }, deliveryAttempts: { orderBy: { attemptedAt: "asc" }, select: { status: true, failureReason: true, notes: true, attemptedAt: true } } } } },
    });
    if (!assignment) fail(404, "Consignment not found");
    return res.status(200).json({ success: true, data: assignment.consignment });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}

export async function updateWorkerDeliveryStatus(req, res, next) {
  try {
    const { id } = req.params;
    if (!isUuid(id)) fail(404, "Consignment not found");
    const workerStatuses = ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"];
    if (!workerStatuses.includes(req.body?.status)) fail(400, "Workers may set status to PICKED_UP, IN_TRANSIT, or OUT_FOR_DELIVERY");
    const result = await prisma.$transaction(async (tx) => {
      if (!await lockConsignment(tx, id)) fail(404, "Consignment not found");
      await assertWorkerAssignment(tx, id, req.user.userId, req.agency.id);
      const consignment = await tx.consignment.findUnique({ where: { id }, select: { id: true, status: true } });
      if (CONSIGNMENT_TERMINAL_STATUSES.includes(consignment.status)) fail(409, "Completed or cancelled consignments cannot be updated");
      if (!VALID_CONSIGNMENT_TRANSITIONS[consignment.status]?.includes(req.body.status)) fail(422, `Cannot change consignment status from ${consignment.status} to ${req.body.status}`);
      await writeStatus(tx, consignment, req.body.status, req.user.userId);
      return tx.consignment.findUnique({ where: { id }, select: deliverySelect });
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (isDatabaseConflict(error)) return res.status(409).json({ success: false, message: "Consignment changed concurrently; reload and try again" });
    return sendControllerError(res, next, error);
  }
}

export async function recordDeliveryAttempt(req, res, next) {
  try {
    const { id } = req.params;
    const { status, failureReason, notes } = req.body ?? {};
    if (!isUuid(id)) fail(404, "Consignment not found");
    if (!["SUCCESSFUL", "FAILED"].includes(status)) fail(400, "status must be SUCCESSFUL or FAILED");
    if (status === "FAILED" && (typeof failureReason !== "string" || !failureReason.trim())) fail(400, "A failureReason is required for a failed delivery");
    if (failureReason !== undefined && (typeof failureReason !== "string" || failureReason.length > 1000)) fail(400, "failureReason must be at most 1000 characters");
    if (notes !== undefined && (typeof notes !== "string" || notes.length > 2000)) fail(400, "notes must be at most 2000 characters");

    const result = await prisma.$transaction(async (tx) => {
      if (!await lockConsignment(tx, id)) fail(404, "Consignment not found");
      const assignment = await assertWorkerAssignment(tx, id, req.user.userId, req.agency.id);
      const consignment = await tx.consignment.findUnique({ where: { id }, select: { id: true, agencyId: true, status: true } });
      if (assignment.agencyId !== consignment.agencyId) fail(404, "No active assignment found for this consignment");
      if (CONSIGNMENT_TERMINAL_STATUSES.includes(consignment.status)) fail(409, "Completed or cancelled consignments cannot be updated");
      if (!["OUT_FOR_DELIVERY", "FAILED_DELIVERY"].includes(consignment.status)) fail(422, "Move the consignment to OUT_FOR_DELIVERY before recording an attempt");

      // A new attempt after a failure is a valid retry: record the transition back to
      // OUT_FOR_DELIVERY before recording its outcome.
      if (consignment.status === "FAILED_DELIVERY") await writeStatus(tx, consignment, "OUT_FOR_DELIVERY", req.user.userId);
      const attempt = await tx.deliveryAttempt.create({
        data: {
          consignmentId: id,
          assignmentId: assignment.id,
          workerId: req.user.userId,
          status,
          failureReason: status === "FAILED" ? failureReason.trim() : null,
          notes: notes?.trim() || null,
        },
        include: { worker: { select: { id: true, name: true } } },
      });

      if (status === "SUCCESSFUL") {
        await writeStatus(tx, consignment, "DELIVERED", req.user.userId);
        await completeBooking(tx, id, req.user.userId);
        await tx.deliveryAssignment.update({ where: { id: assignment.id }, data: { isActive: false, unassignedAt: new Date() } });
      } else {
        await writeStatus(tx, consignment, "FAILED_DELIVERY", req.user.userId);
      }
      return { attempt, status: consignment.status };
    });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (isDatabaseConflict(error)) return res.status(409).json({ success: false, message: "Consignment changed concurrently; reload and try again" });
    return sendControllerError(res, next, error);
  }
}

export async function listAgencyDeliveryAttempts(req, res, next) {
  try {
    const { consignmentId, date } = req.query;
    const where = { consignment: { agencyId: req.agency.id } };
    if (consignmentId !== undefined) {
      if (!isUuid(consignmentId)) fail(400, "consignmentId must be a valid UUID");
      where.consignmentId = consignmentId;
    }
    if (date !== undefined) {
      const parsed = dateOnly(date, { allowPast: true });
      if (!parsed) fail(400, "date must use YYYY-MM-DD format");
      where.attemptedAt = dayBounds(parsed);
    }
    const attempts = await prisma.deliveryAttempt.findMany({ where, orderBy: { attemptedAt: "desc" }, include: attemptInclude });
    return res.status(200).json({ success: true, data: attempts });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}
