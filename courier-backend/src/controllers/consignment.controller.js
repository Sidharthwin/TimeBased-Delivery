import { randomBytes } from "node:crypto";
import prisma from "../config/database.js";
import { isValidTrackingNumber, VALID_CONSIGNMENT_TRANSITIONS } from "./delivery/shared.js";

const CONSIGNMENT_STATUSES = [
    "CREATED",
    "CONFIRMED",
    "PICKED_UP",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "FAILED_DELIVERY"
];

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isIndianPhone = (value) => /^(?:\+91[- ]?)?[6-9]\d{9}$/.test(value.trim());
const isPostalCode = (value) => /^\d{6}$/.test(value.trim());
const isUuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const publicTrackingSelect = {
    trackingNumber: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    agency: { select: { name: true } },
    statusHistory: {
        orderBy: { createdAt: "asc" },
        select: { fromStatus: true, toStatus: true, createdAt: true }
    },
    bookings: {
        where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
        orderBy: { bookedAt: "desc" },
        take: 1,
        select: { status: true, slotDate: true, slotStartTime: true, slotEndTime: true }
    },
};

export const createConsignment = async (req, res, next) => {
    try {
        const {
            agencyId,
            senderName,
            senderPhone,
            senderAddress,
            senderPostalCode,
            receiverName,
            receiverPhone,
            receiverAddress,
            receiverPostalCode,
            packageDescription,
            packageWeight
        } = req.body ?? {};

        const requiredStrings = [
            senderName, senderPhone, senderAddress, senderPostalCode,
            receiverName, receiverPhone, receiverAddress, receiverPostalCode,
            packageDescription
        ];

        if (!requiredStrings.every(isNonEmptyString) || !isUuid(agencyId)) {
            return res.status(400).json({
                success: false,
                message: "A courier agency and all sender, receiver and package details are required"
            });
        }

        if (!isIndianPhone(senderPhone) || !isIndianPhone(receiverPhone)) {
            return res.status(400).json({
                success: false,
                message: "Sender and receiver phone numbers must be valid Indian mobile numbers"
            });
        }

        if (!isPostalCode(senderPostalCode) || !isPostalCode(receiverPostalCode)) {
            return res.status(400).json({
                success: false,
                message: "Sender and receiver postal codes must contain six digits"
            });
        }

        const weight = typeof packageWeight === "number" ? packageWeight : Number.NaN;
        if (!Number.isFinite(weight) || weight <= 0 || weight > 99999.999 || !/^\d+(?:\.\d{1,3})?$/.test(String(packageWeight))) {
            return res.status(400).json({
                success: false,
                message: "Package weight must be a positive number in kilograms with at most three decimal places"
            });
        }

        const postalCodes = [...new Set([senderPostalCode.trim(), receiverPostalCode.trim()])];
        const coveredAreas = await prisma.serviceArea.findMany({
            where: {
                agencyId,
                postalCode: { in: postalCodes }
            },
            select: { postalCode: true }
        });

        if (coveredAreas.length !== postalCodes.length) {
            return res.status(422).json({
                success: false,
                message: "The selected courier agency does not serve both postal codes"
            });
        }

        const trackingNumber = `CDM-${randomBytes(12).toString("hex").toUpperCase()}`;
        const consignment = await prisma.$transaction(async (tx) => {
            const created = await tx.consignment.create({
                data: {
                    trackingNumber,
                    customerId: req.user.userId,
                    agencyId,
                    senderName: senderName.trim(),
                    senderPhone: senderPhone.trim(),
                    senderAddress: senderAddress.trim(),
                    senderPostalCode: senderPostalCode.trim(),
                    receiverName: receiverName.trim(),
                    receiverPhone: receiverPhone.trim(),
                    receiverAddress: receiverAddress.trim(),
                    receiverPostalCode: receiverPostalCode.trim(),
                    packageDescription: packageDescription.trim(),
                    packageWeight: weight.toFixed(3)
                }
            });

            await tx.consignmentStatusHistory.create({
                data: {
                    consignmentId: created.id,
                    fromStatus: null,
                    toStatus: "CREATED",
                    changedById: req.user.userId
                }
            });

            return created;
        });

        return res.status(201).json({
            success: true,
            message: "Consignment created successfully",
            data: consignment
        });
    } catch (error) {
        if (error.code === "P2003") {
            return res.status(400).json({ success: false, message: "The selected courier agency is invalid" });
        }
        return next(error);
    }
};

export const listAgencyConsignments = async (req, res, next) => {
    try {
        const pageValue = req.query.page ?? "1";
        const limitValue = req.query.limit ?? "20";
        if (!/^\d+$/.test(String(pageValue)) || !/^\d+$/.test(String(limitValue))) {
            return res.status(400).json({ success: false, message: "Page and limit must be whole numbers" });
        }
        const page = Number(pageValue);
        const limit = Number(limitValue);
        const { status, trackingNumber } = req.query;

        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
            return res.status(400).json({ success: false, message: "Page must be positive and limit must be between 1 and 100" });
        }
        if (status && !CONSIGNMENT_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid consignment status filter" });
        }
        if (trackingNumber !== undefined && !isNonEmptyString(trackingNumber)) {
            return res.status(400).json({ success: false, message: "Tracking number filter cannot be empty" });
        }

        const where = {
            agencyId: req.agency.id,
            ...(status ? { status } : {}),
            ...(trackingNumber ? { trackingNumber: trackingNumber.trim() } : {})
        };
        const [items, total] = await prisma.$transaction([
            prisma.consignment.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.consignment.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            data: items,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        return next(error);
    }
};

export const getConsignment = async (req, res, next) => {
    try {
        if (!isUuid(req.params.id)) {
            return res.status(404).json({ success: false, message: "Consignment not found" });
        }

        let where;
        if (req.user.agencyId) {
            const membership = await prisma.agencyUser.findUnique({
                where: {
                    userId_agencyId: {
                        userId: req.user.userId,
                        agencyId: req.user.agencyId
                    }
                },
                select: { isActive: true, role: true }
            });

            if (!membership?.isActive || !["AGENCY_ADMIN", "DISPATCHER", "DELIVERY_WORKER"].includes(membership.role)) {
                return res.status(403).json({ success: false, message: "Active agency membership required" });
            }
            if (membership.role === "DELIVERY_WORKER") {
                return res.status(403).json({ success: false, message: "Delivery workers can only view assigned consignments" });
            }
            where = { id: req.params.id, agencyId: req.user.agencyId };
        } else if (req.user.role === "CUSTOMER") {
            where = { id: req.params.id, customerId: req.user.userId };
        } else {
            return res.status(403).json({ success: false, message: "You are not authorized to view this consignment" });
        }

        const consignment = await prisma.consignment.findFirst({
            where,
            include: {
                statusHistory: {
                    orderBy: { createdAt: "asc" },
                        select: { fromStatus: true, toStatus: true, createdAt: true }
                }
            }
        });

        if (!consignment) {
            return res.status(404).json({ success: false, message: "Consignment not found" });
        }
        return res.status(200).json({ success: true, data: consignment });
    } catch (error) {
        return next(error);
    }
};

export const updateConsignmentStatus = async (req, res, next) => {
    try {
        if (!isUuid(req.params.id)) {
            return res.status(404).json({ success: false, message: "Consignment not found" });
        }

        const { status } = req.body ?? {};
        if (!CONSIGNMENT_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: "A valid consignment status is required" });
        }
        if (["DELIVERED", "FAILED_DELIVERY"].includes(status)) {
            return res.status(403).json({
                success: false,
                message: "Delivery outcomes must be recorded by the currently assigned delivery worker"
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw`SELECT "id" FROM "Consignment" WHERE "id" = ${req.params.id}::uuid AND "agencyId" = ${req.agency.id}::uuid FOR UPDATE`;
            if (locked.length === 0) return { kind: "missing" };
            const current = await tx.consignment.findFirst({
                where: { id: req.params.id, agencyId: req.agency.id },
                select: { id: true, status: true }
            });
            if (!current) return { kind: "missing" };
            if (!VALID_CONSIGNMENT_TRANSITIONS[current.status].includes(status)) {
                return { kind: "invalid-transition", currentStatus: current.status };
            }

            const updated = await tx.consignment.updateMany({
                where: { id: current.id, agencyId: req.agency.id, status: current.status },
                data: { status }
            });
            if (updated.count !== 1) return { kind: "conflict" };

            const updatedConsignment = await tx.consignment.findUnique({ where: { id: current.id } });
            await tx.consignmentStatusHistory.create({
                data: {
                    consignmentId: current.id,
                    fromStatus: current.status,
                    toStatus: status,
                    changedById: req.user.userId
                }
            });
            if (status === "CANCELLED") {
                const activeBookings = await tx.booking.findMany({
                    where: { consignmentId: current.id, status: "CONFIRMED" },
                });
                for (const booking of activeBookings) {
                    await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id}::uuid FOR UPDATE`;
                    await tx.$queryRaw`SELECT "id" FROM "DeliverySlot" WHERE "id" = ${booking.slotId}::uuid FOR UPDATE`;
                    const cancelled = await tx.booking.update({
                        where: { id: booking.id },
                        data: { status: "CANCELLED", cancelledAt: new Date() }
                    });
                    await tx.bookingHistory.create({
                        data: {
                            bookingId: booking.id,
                            action: "CANCELLED",
                            fromSlotDate: booking.slotDate,
                            fromStartTime: booking.slotStartTime,
                            fromEndTime: booking.slotEndTime,
                            toSlotDate: cancelled.slotDate,
                            toStartTime: cancelled.slotStartTime,
                            toEndTime: cancelled.slotEndTime,
                            changedById: req.user.userId
                        }
                    });
                }
            }
            return { kind: "updated", consignment: updatedConsignment };
        });

        if (result.kind === "missing") {
            return res.status(404).json({ success: false, message: "Consignment not found" });
        }
        if (result.kind === "invalid-transition") {
            return res.status(400).json({
                success: false,
                message: `Cannot change consignment status from ${result.currentStatus} to ${status}`
            });
        }
        if (result.kind === "conflict") {
            return res.status(409).json({ success: false, message: "Consignment status changed concurrently; reload and try again" });
        }
        return res.status(200).json({ success: true, message: "Consignment status updated", data: result.consignment });
    } catch (error) {
        return next(error);
    }
};

export const trackConsignment = async (req, res, next) => {
    try {
        if (!isValidTrackingNumber(req.params.trackingNumber)) {
            return res.status(404).json({ success: false, message: "Tracking number not found" });
        }
        const consignment = await prisma.consignment.findUnique({
            where: { trackingNumber: req.params.trackingNumber },
            select: publicTrackingSelect
        });

        if (!consignment) {
            return res.status(404).json({ success: false, message: "Tracking number not found" });
        }
        const booking = consignment.bookings[0];
        const time = (value) => `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
        const { bookings, ...tracking } = consignment;
        return res.status(200).json({
            success: true,
            data: {
                ...tracking,
                deliverySlot: booking ? {
                    status: booking.status,
                    date: booking.slotDate.toISOString().slice(0, 10),
                    startTime: time(booking.slotStartTime),
                    endTime: time(booking.slotEndTime)
                } : null
            }
        });
    } catch (error) {
        return next(error);
    }
};
