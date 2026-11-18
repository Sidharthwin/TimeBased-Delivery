import prisma from "../../config/database.js";
import {
  BOOKING_STATUSES, bookingView, dateOnly, dayBounds, isBookableConsignmentStatus,
  fail, isDatabaseConflict, isUuid, lockBooking, lockConsignment, lockSlot, lockSlots, sendControllerError,
} from "./shared.js";

const bookingInclude = {
  consignment: { select: { trackingNumber: true, status: true } },
  agency: { select: { name: true } },
};

async function addHistory(tx, booking, action, actorId, from = null) {
  await tx.bookingHistory.create({
    data: {
      bookingId: booking.id,
      action,
      fromSlotDate: from?.slotDate ?? null,
      fromStartTime: from?.slotStartTime ?? null,
      fromEndTime: from?.slotEndTime ?? null,
      toSlotDate: booking.slotDate ?? null,
      toStartTime: booking.slotStartTime ?? null,
      toEndTime: booking.slotEndTime ?? null,
      changedById: actorId,
    },
  });
}

function validateFilter(query) {
  const where = {};
  if (query.status !== undefined) {
    if (!BOOKING_STATUSES.includes(query.status)) fail(400, "Invalid booking status filter");
    where.status = query.status;
  }
  if (query.date !== undefined) {
    const date = dateOnly(query.date, { allowPast: true });
    if (!date) fail(400, "date must use YYYY-MM-DD format");
    where.slotDate = dayBounds(date);
  }
  return where;
}

export async function createBooking(req, res, next) {
  try {
    const { slotId, consignmentId } = req.body ?? {};
    if (!isUuid(slotId) || !isUuid(consignmentId)) fail(400, "Valid slotId and consignmentId are required");

    const result = await prisma.$transaction(async (tx) => {
      if (!await lockConsignment(tx, consignmentId)) fail(404, "Consignment not found");
      const consignment = await tx.consignment.findFirst({
        where: { id: consignmentId, customerId: req.user.userId },
        select: { id: true, agencyId: true, customerId: true, status: true },
      });
      if (!consignment) fail(404, "Consignment not found");
      if (!isBookableConsignmentStatus(consignment.status)) fail(422, "Completed or cancelled consignments cannot be booked");

      const activeBooking = await tx.booking.findFirst({ where: { consignmentId, status: "CONFIRMED" }, select: { id: true } });
      if (activeBooking) fail(409, "This consignment already has a confirmed delivery booking");
      if (!await lockSlot(tx, slotId)) fail(404, "Delivery slot not found");
      const slot = await tx.deliverySlot.findUnique({ where: { id: slotId } });
      if (!slot || slot.agencyId !== consignment.agencyId) fail(404, "Delivery slot not found for this consignment's agency");
      if (!slot.isActive) fail(422, "This delivery slot is inactive");
      if (slot.date.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) fail(422, "Past delivery slots cannot be booked");

      const booked = await tx.booking.count({ where: { slotId, status: "CONFIRMED" } });
      if (booked >= slot.capacity) fail(409, "Delivery slot capacity is exhausted");
      const booking = await tx.booking.create({
        data: {
          consignmentId,
          slotId,
          customerId: req.user.userId,
          agencyId: consignment.agencyId,
          slotDate: slot.date,
          slotStartTime: slot.startTime,
          slotEndTime: slot.endTime,
        },
      });
      await addHistory(tx, booking, "CREATED", req.user.userId);
      return tx.booking.findUnique({ where: { id: booking.id }, include: bookingInclude });
    });

    return res.status(201).json({ success: true, data: bookingView(result) });
  } catch (error) {
    if (isDatabaseConflict(error)) return res.status(409).json({ success: false, message: "Booking conflicts with an existing active booking" });
    return sendControllerError(res, next, error);
  }
}

export async function listCustomerBookings(req, res, next) {
  try {
    const where = { customerId: req.user.userId, ...validateFilter(req.query) };
    const bookings = await prisma.booking.findMany({ where, orderBy: [{ slotDate: "asc" }, { bookedAt: "desc" }], include: bookingInclude });
    return res.status(200).json({ success: true, data: bookings.map(bookingView) });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}

export async function getCustomerBooking(req, res, next) {
  try {
    if (!isUuid(req.params.id)) fail(404, "Booking not found");
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id, customerId: req.user.userId }, include: bookingInclude });
    if (!booking) fail(404, "Booking not found");
    return res.status(200).json({ success: true, data: bookingView(booking) });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}

export async function cancelBooking(req, res, next) {
  try {
    if (!isUuid(req.params.id)) fail(404, "Booking not found");
    const booking = await prisma.$transaction(async (tx) => {
      const initial = await tx.booking.findFirst({ where: { id: req.params.id, customerId: req.user.userId }, select: { id: true, consignmentId: true } });
      if (!initial) fail(404, "Booking not found");
      if (!await lockConsignment(tx, initial.consignmentId) || !await lockBooking(tx, initial.id)) fail(404, "Booking not found");
      const current = await tx.booking.findFirst({ where: { id: initial.id, customerId: req.user.userId } });
      if (!current) fail(404, "Booking not found");
      if (current.status !== "CONFIRMED") fail(409, "Only confirmed bookings can be cancelled");
      await lockSlots(tx, [current.slotId]);
      const updated = await tx.booking.update({ where: { id: current.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await addHistory(tx, updated, "CANCELLED", req.user.userId, current);
      return tx.booking.findUnique({ where: { id: updated.id }, include: bookingInclude });
    });
    return res.status(200).json({ success: true, data: bookingView(booking) });
  } catch (error) {
    if (isDatabaseConflict(error)) return res.status(409).json({ success: false, message: "Booking changed concurrently; reload and try again" });
    return sendControllerError(res, next, error);
  }
}

export async function rescheduleBooking(req, res, next) {
  try {
    const { slotId } = req.body ?? {};
    if (!isUuid(req.params.id)) fail(404, "Booking not found");
    if (!isUuid(slotId)) fail(400, "A valid slotId is required");

    const booking = await prisma.$transaction(async (tx) => {
      const initial = await tx.booking.findFirst({ where: { id: req.params.id, customerId: req.user.userId }, select: { id: true, consignmentId: true } });
      if (!initial) fail(404, "Booking not found");
      if (!await lockConsignment(tx, initial.consignmentId) || !await lockBooking(tx, initial.id)) fail(404, "Booking not found");
      const current = await tx.booking.findFirst({ where: { id: initial.id, customerId: req.user.userId } });
      if (!current) fail(404, "Booking not found");
      if (current.status !== "CONFIRMED") fail(409, "Only confirmed bookings can be rescheduled");
      const consignment = await tx.consignment.findUnique({ where: { id: current.consignmentId }, select: { agencyId: true, status: true } });
      if (!consignment || !isBookableConsignmentStatus(consignment.status)) fail(422, "Completed or cancelled consignments cannot be rescheduled");
      if (current.slotId === slotId) fail(400, "Choose a different delivery slot to reschedule");
      await lockSlots(tx, [current.slotId, slotId]);
      const target = await tx.deliverySlot.findUnique({ where: { id: slotId } });
      if (!target || target.agencyId !== current.agencyId) fail(404, "Delivery slot not found for this consignment's agency");
      if (!target.isActive) fail(422, "This delivery slot is inactive");
      if (target.date.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) fail(422, "Past delivery slots cannot be booked");
      const booked = await tx.booking.count({ where: { slotId, status: "CONFIRMED" } });
      if (booked >= target.capacity) fail(409, "Delivery slot capacity is exhausted");
      const updated = await tx.booking.update({
        where: { id: current.id },
        data: { slotId, slotDate: target.date, slotStartTime: target.startTime, slotEndTime: target.endTime },
      });
      await addHistory(tx, updated, "RESCHEDULED", req.user.userId, current);
      return tx.booking.findUnique({ where: { id: updated.id }, include: bookingInclude });
    });
    return res.status(200).json({ success: true, data: bookingView(booking) });
  } catch (error) {
    if (isDatabaseConflict(error)) return res.status(409).json({ success: false, message: "Booking changed concurrently; reload and try again" });
    return sendControllerError(res, next, error);
  }
}

export async function listAgencyBookings(req, res, next) {
  try {
    const where = { agencyId: req.agency.id, ...validateFilter(req.query) };
    const bookings = await prisma.booking.findMany({ where, orderBy: [{ slotDate: "asc" }, { bookedAt: "desc" }], include: bookingInclude });
    return res.status(200).json({ success: true, data: bookings.map(bookingView) });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}

export async function getAgencyBooking(req, res, next) {
  try {
    if (!isUuid(req.params.id)) fail(404, "Booking not found");
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id, agencyId: req.agency.id }, include: bookingInclude });
    if (!booking) fail(404, "Booking not found");
    return res.status(200).json({ success: true, data: bookingView(booking) });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}
