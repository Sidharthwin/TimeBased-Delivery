export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const fail = (status, message) => { throw new ApiError(status, message); };
export const isUuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const BOOKING_STATUSES = ["CONFIRMED", "CANCELLED", "COMPLETED"];
export const CONSIGNMENT_TERMINAL_STATUSES = ["DELIVERED", "CANCELLED"];
export const VALID_CONSIGNMENT_TRANSITIONS = {
  CREATED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_DELIVERY"],
  FAILED_DELIVERY: ["IN_TRANSIT", "OUT_FOR_DELIVERY"],
  DELIVERED: [],
  CANCELLED: [],
};
export const isValidTrackingNumber = (value) => typeof value === "string" && /^CDM-[A-F0-9]{24}$/.test(value);
export const isBookableConsignmentStatus = (status) => !CONSIGNMENT_TERMINAL_STATUSES.includes(status);

export function dateOnly(value, { allowPast = false } = {}) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (!allowPast && value < today) return null;
  return date;
}

export function timeOnly(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) return null;
  return new Date(`1970-01-01T${value}:00.000Z`);
}

export function timeLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export function dateLabel(value) {
  return (value instanceof Date ? value : new Date(value)).toISOString().slice(0, 10);
}

export function slotView(slot, confirmedCount = 0) {
  return {
    id: slot.id,
    agencyId: slot.agencyId,
    date: dateLabel(slot.date),
    startTime: timeLabel(slot.startTime),
    endTime: timeLabel(slot.endTime),
    capacity: slot.capacity,
    booked: confirmedCount,
    remaining: Math.max(0, slot.capacity - confirmedCount),
    isActive: slot.isActive,
  };
}

export function bookingView(booking) {
  return {
    id: booking.id,
    status: booking.status,
    bookedAt: booking.bookedAt,
    cancelledAt: booking.cancelledAt,
    slot: {
      date: dateLabel(booking.slotDate),
      startTime: timeLabel(booking.slotStartTime),
      endTime: timeLabel(booking.slotEndTime),
    },
    consignment: booking.consignment ? {
      trackingNumber: booking.consignment.trackingNumber,
      status: booking.consignment.status,
    } : undefined,
    agency: booking.agency ? { name: booking.agency.name } : undefined,
  };
}

export async function lockAgency(tx, agencyId) {
  const rows = await tx.$queryRaw`SELECT "id" FROM "CourierAgency" WHERE "id" = ${agencyId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

export async function lockConsignment(tx, consignmentId) {
  const rows = await tx.$queryRaw`SELECT "id" FROM "Consignment" WHERE "id" = ${consignmentId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

export async function lockSlot(tx, slotId) {
  const rows = await tx.$queryRaw`SELECT "id" FROM "DeliverySlot" WHERE "id" = ${slotId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

export async function lockSlots(tx, slotIds) {
  for (const slotId of [...new Set(slotIds)].sort()) await lockSlot(tx, slotId);
}

export async function lockBooking(tx, bookingId) {
  const rows = await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

export function isDatabaseConflict(error) {
  return error?.code === "P2002" || error?.code === "P2004" || error?.code === "P2034" || error?.code === "23505" || error?.code === "23P01";
}

export function sendControllerError(res, next, error) {
  if (error instanceof ApiError) return res.status(error.status).json({ success: false, message: error.message });
  return next(error);
}

export function dayBounds(date) {
  const start = new Date(date);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { gte: start, lt: end };
}
