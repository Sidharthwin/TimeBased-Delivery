import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  bookingView, dateOnly, isBookableConsignmentStatus, isDatabaseConflict,
  isValidTrackingNumber, slotView, timeLabel, timeOnly, VALID_CONSIGNMENT_TRANSITIONS,
} from "../src/controllers/delivery/shared.js";
import publicTrackingRateLimit from "../src/middleware/publicTrackingRateLimit.js";

test("date-only validation rejects malformed, impossible, and past dates", () => {
  assert.equal(dateOnly("2024-02-30", { allowPast: true }), null);
  assert.equal(dateOnly("2024-2-03", { allowPast: true }), null);
  assert.equal(dateOnly("not-a-date", { allowPast: true }), null);
  assert.equal(dateOnly("2020-02-29", { allowPast: true }).toISOString(), "2020-02-29T00:00:00.000Z");
  const tomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  assert.equal(dateOnly(tomorrow)?.toISOString().slice(0, 10), tomorrow);
});

test("slot time parsing accepts valid 24-hour HH:mm values only", () => {
  assert.equal(timeOnly("09:05").toISOString(), "1970-01-01T09:05:00.000Z");
  assert.equal(timeOnly("23:59").toISOString(), "1970-01-01T23:59:00.000Z");
  for (const value of ["24:00", "9:05", "12:60", "12:00:00", "noon"]) assert.equal(timeOnly(value), null);
  assert.equal(timeLabel(new Date("1970-01-01T09:05:00.000Z")), "09:05");
});

test("slot availability never reports negative capacity", () => {
  const slot = {
    id: "slot-id", agencyId: "agency-id", date: new Date("2026-12-01T00:00:00Z"),
    startTime: new Date("1970-01-01T09:00:00Z"), endTime: new Date("1970-01-01T12:00:00Z"),
    capacity: 10, isActive: true,
  };
  assert.deepEqual(slotView(slot, 7), {
    id: "slot-id", agencyId: "agency-id", date: "2026-12-01", startTime: "09:00", endTime: "12:00",
    capacity: 10, booked: 7, remaining: 3, isActive: true,
  });
  assert.equal(slotView(slot, 13).remaining, 0);
});

test("booking API projection contains slot history without exposing personal data", () => {
  const booking = bookingView({
    id: "booking-id", status: "CONFIRMED", bookedAt: new Date("2026-11-18T10:00:00Z"), cancelledAt: null,
    slotDate: new Date("2026-12-01T00:00:00Z"), slotStartTime: new Date("1970-01-01T09:00:00Z"),
    slotEndTime: new Date("1970-01-01T12:00:00Z"),
    customerId: "private-customer-id", consignment: { trackingNumber: "CDM-000000000000000000000000", status: "CONFIRMED", receiverPhone: "private" },
    agency: { name: "Test Courier" },
  });
  assert.equal(booking.slot.startTime, "09:00");
  assert.equal(booking.agency.name, "Test Courier");
  assert.equal("customerId" in booking, false);
  assert.equal("receiverPhone" in booking.consignment, false);
});

test("terminal shipment states cannot be booked and tracking numbers are canonical", () => {
  assert.equal(isBookableConsignmentStatus("CONFIRMED"), true);
  assert.equal(isBookableConsignmentStatus("DELIVERED"), false);
  assert.equal(isBookableConsignmentStatus("CANCELLED"), false);
  assert.equal(isValidTrackingNumber("CDM-0123456789ABCDEF01234567"), true);
  assert.equal(isValidTrackingNumber("CDM-0123456789abcdef01234567"), false);
  assert.equal(isValidTrackingNumber("CDM-too-short"), false);
});

test("delivery state graph permits pickup, transit, retry, and worker-reported outcomes", () => {
  assert.deepEqual(VALID_CONSIGNMENT_TRANSITIONS.CONFIRMED, ["PICKED_UP", "CANCELLED"]);
  assert.ok(VALID_CONSIGNMENT_TRANSITIONS.PICKED_UP.includes("IN_TRANSIT"));
  assert.ok(VALID_CONSIGNMENT_TRANSITIONS.IN_TRANSIT.includes("OUT_FOR_DELIVERY"));
  assert.ok(VALID_CONSIGNMENT_TRANSITIONS.OUT_FOR_DELIVERY.includes("DELIVERED"));
  assert.ok(VALID_CONSIGNMENT_TRANSITIONS.OUT_FOR_DELIVERY.includes("FAILED_DELIVERY"));
  assert.ok(VALID_CONSIGNMENT_TRANSITIONS.FAILED_DELIVERY.includes("OUT_FOR_DELIVERY"));
  assert.deepEqual(VALID_CONSIGNMENT_TRANSITIONS.DELIVERED, []);
});

test("database uniqueness, overlap, and check constraints back up API validation", async () => {
  const migration = await readFile(new URL("../prisma/migrations/20261118110000_delivery_workflow/migration.sql", import.meta.url), "utf8");
  assert.match(migration, /CHECK \("startTime" < "endTime"\)/);
  assert.match(migration, /CHECK \("capacity" > 0\)/);
  assert.match(migration, /"Booking_one_confirmed_per_consignment_key"[\s\S]*WHERE "status" = 'CONFIRMED'/);
  assert.match(migration, /"DeliveryAssignment_one_active_per_consignment_key"[\s\S]*WHERE "isActive" = TRUE/);
  assert.match(migration, /"DeliverySlot_no_overlap"[\s\S]*EXCLUDE USING gist/);
});

test("Prisma/PostgreSQL conflict codes are recognized for HTTP 409 responses", () => {
  for (const code of ["P2002", "P2004", "P2034", "23505", "23P01"]) assert.equal(isDatabaseConflict({ code }), true);
  assert.equal(isDatabaseConflict({ code: "P2025" }), false);
});

test("public tracking limiter allows 40 requests and rejects the next one", () => {
  const ip = `delivery-test-${Date.now()}-${Math.random()}`;
  let nextCount = 0;
  let statusCode = 200;
  let body;
  const makeResponse = () => ({
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  });
  for (let i = 0; i < 40; i += 1) {
    publicTrackingRateLimit({ ip, socket: {} }, makeResponse(), () => { nextCount += 1; });
  }
  publicTrackingRateLimit({ ip, socket: {} }, makeResponse(), () => { nextCount += 1; });
  assert.equal(nextCount, 40);
  assert.equal(statusCode, 429);
  assert.equal(body.success, false);
});
