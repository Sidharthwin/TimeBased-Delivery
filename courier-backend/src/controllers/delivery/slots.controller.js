import prisma from "../../config/database.js";
import {
  dateOnly, dateLabel, fail, isDatabaseConflict, isUuid, lockAgency, lockSlot,
  sendControllerError, slotView, timeLabel, timeOnly,
} from "./shared.js";

const slotSelect = { id: true, agencyId: true, date: true, startTime: true, endTime: true, capacity: true, isActive: true };

function parseSlotFields(body, partial = false) {
  const fields = {};
  const provided = (key) => Object.prototype.hasOwnProperty.call(body ?? {}, key);
  if (!partial || provided("date")) {
    fields.date = dateOnly(body?.date);
    if (!fields.date) fail(400, "date must be a valid YYYY-MM-DD date that is not in the past");
  }
  if (!partial || provided("startTime")) {
    fields.startTime = timeOnly(body?.startTime);
    if (!fields.startTime) fail(400, "startTime must use 24-hour HH:mm format");
  }
  if (!partial || provided("endTime")) {
    fields.endTime = timeOnly(body?.endTime);
    if (!fields.endTime) fail(400, "endTime must use 24-hour HH:mm format");
  }
  if (fields.startTime && fields.endTime && fields.startTime >= fields.endTime) fail(400, "startTime must be earlier than endTime");
  if (!partial || provided("capacity")) {
    if (!Number.isSafeInteger(body?.capacity) || body.capacity <= 0) fail(400, "capacity must be a positive integer");
    fields.capacity = body.capacity;
  }
  return fields;
}

export async function createSlot(req, res, next) {
  try {
    const fields = parseSlotFields(req.body);
    const slot = await prisma.$transaction(async (tx) => {
      if (!await lockAgency(tx, req.agency.id)) fail(404, "Agency not found");
      return tx.deliverySlot.create({ data: { agencyId: req.agency.id, ...fields }, select: slotSelect });
    });
    return res.status(201).json({ success: true, data: slotView(slot) });
  } catch (error) {
    if (isDatabaseConflict(error)) return res.status(409).json({ success: false, message: "An active slot already overlaps this time, or the slot conflicts with existing data" });
    return sendControllerError(res, next, error);
  }
}

export async function listAgencySlots(req, res, next) {
  try {
    const date = req.query.date;
    const where = { agencyId: req.agency.id };
    if (date !== undefined) {
      const parsed = dateOnly(date, { allowPast: true });
      if (!parsed) fail(400, "date must use YYYY-MM-DD format");
      where.date = parsed;
    }
    const slots = await prisma.deliverySlot.findMany({ where, orderBy: [{ date: "asc" }, { startTime: "asc" }], select: slotSelect });
    const counts = await prisma.booking.groupBy({
      by: ["slotId"], where: { slotId: { in: slots.map((slot) => slot.id) }, status: "CONFIRMED" }, _count: { _all: true },
    });
    const booked = new Map(counts.map((item) => [item.slotId, item._count._all]));
    return res.status(200).json({ success: true, data: slots.map((slot) => slotView(slot, booked.get(slot.id) ?? 0)) });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}

export async function listAvailableSlots(req, res, next) {
  try {
    const { agencyId, date: dateParam } = req.query;
    const date = dateOnly(dateParam);
    if (!isUuid(agencyId) || !date) fail(400, "A valid agencyId and future YYYY-MM-DD date are required");
    const slots = await prisma.deliverySlot.findMany({
      where: { agencyId, date, isActive: true }, orderBy: { startTime: "asc" }, select: slotSelect,
    });
    const counts = await prisma.booking.groupBy({
      by: ["slotId"], where: { slotId: { in: slots.map((slot) => slot.id) }, status: "CONFIRMED" }, _count: { _all: true },
    });
    const booked = new Map(counts.map((item) => [item.slotId, item._count._all]));
    return res.status(200).json({
      success: true,
      data: slots.map((slot) => slotView(slot, booked.get(slot.id) ?? 0)).filter((slot) => slot.remaining > 0),
    });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}

export async function updateSlot(req, res, next) {
  try {
    if (!isUuid(req.params.id)) fail(404, "Delivery slot not found");
    const fields = parseSlotFields(req.body, true);
    if (!Object.keys(fields).length) fail(400, "Provide at least one slot field to update");
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.deliverySlot.findFirst({ where: { id: req.params.id, agencyId: req.agency.id }, select: slotSelect });
      if (!existing) fail(404, "Delivery slot not found");
      if (!await lockAgency(tx, req.agency.id) || !await lockSlot(tx, existing.id)) fail(404, "Delivery slot not found");

      const hasConfirmedBookings = await tx.booking.count({ where: { slotId: existing.id, status: "CONFIRMED" } });
      const timeChanged = (fields.date && dateLabel(fields.date) !== dateLabel(existing.date)) ||
        (fields.startTime && timeLabel(fields.startTime) !== timeLabel(existing.startTime)) ||
        (fields.endTime && timeLabel(fields.endTime) !== timeLabel(existing.endTime));
      if (hasConfirmedBookings > 0 && timeChanged) fail(409, "A slot with confirmed bookings cannot change its date or times");
      if (fields.capacity !== undefined && fields.capacity < hasConfirmedBookings) fail(409, "Capacity cannot be lower than the number of confirmed bookings");
      const slot = await tx.deliverySlot.update({ where: { id: existing.id }, data: fields, select: slotSelect });
      return { slot, booked: hasConfirmedBookings };
    });
    return res.status(200).json({ success: true, data: slotView(result.slot, result.booked) });
  } catch (error) {
    if (isDatabaseConflict(error)) return res.status(409).json({ success: false, message: "The slot overlaps another active slot or conflicts with existing data" });
    return sendControllerError(res, next, error);
  }
}

export async function deactivateSlot(req, res, next) {
  try {
    if (!isUuid(req.params.id)) fail(404, "Delivery slot not found");
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.deliverySlot.findFirst({ where: { id: req.params.id, agencyId: req.agency.id }, select: slotSelect });
      if (!existing) fail(404, "Delivery slot not found");
      if (!await lockAgency(tx, req.agency.id) || !await lockSlot(tx, existing.id)) fail(404, "Delivery slot not found");
      const slot = await tx.deliverySlot.update({ where: { id: existing.id }, data: { isActive: false }, select: slotSelect });
      const booked = await tx.booking.count({ where: { slotId: existing.id, status: "CONFIRMED" } });
      return { slot, booked };
    });
    return res.status(200).json({ success: true, data: slotView(result.slot, result.booked) });
  } catch (error) {
    if (isDatabaseConflict(error)) return res.status(409).json({ success: false, message: "Slot update conflicts with existing data" });
    return sendControllerError(res, next, error);
  }
}
