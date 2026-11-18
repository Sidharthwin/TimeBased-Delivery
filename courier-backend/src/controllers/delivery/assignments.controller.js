import prisma from "../../config/database.js";
import {
  CONSIGNMENT_TERMINAL_STATUSES, fail, isDatabaseConflict, isUuid, lockConsignment,
  sendControllerError,
} from "./shared.js";

const assignmentInclude = {
  employee: { select: { id: true, name: true } },
  consignment: { select: { id: true, trackingNumber: true, status: true, receiverName: true, receiverPhone: true, receiverAddress: true, receiverPostalCode: true, packageDescription: true } },
};

export async function assignWorker(req, res, next) {
  try {
    const { consignmentId } = req.params;
    const { employeeId } = req.body ?? {};
    if (!isUuid(consignmentId) || !isUuid(employeeId)) fail(400, "Valid consignmentId and employeeId are required");
    const result = await prisma.$transaction(async (tx) => {
      if (!await lockConsignment(tx, consignmentId)) fail(404, "Consignment not found in this agency");
      const consignment = await tx.consignment.findFirst({
        where: { id: consignmentId, agencyId: req.agency.id },
        select: { id: true, agencyId: true, status: true },
      });
      if (!consignment) fail(404, "Consignment not found in this agency");
      if (CONSIGNMENT_TERMINAL_STATUSES.includes(consignment.status)) fail(422, "Completed or cancelled consignments cannot be assigned");
      const membership = await tx.agencyUser.findFirst({
        where: { userId: employeeId, agencyId: req.agency.id, role: "DELIVERY_WORKER", isActive: true },
        select: { userId: true },
      });
      if (!membership) fail(422, "The selected user is not an active delivery worker in this agency");

      const current = await tx.deliveryAssignment.findFirst({ where: { consignmentId, isActive: true } });
      if (current?.employeeId === employeeId) return { assignment: await tx.deliveryAssignment.findUnique({ where: { id: current.id }, include: assignmentInclude }), created: false };
      if (current) {
        await tx.deliveryAssignment.update({ where: { id: current.id }, data: { isActive: false, unassignedAt: new Date() } });
      }
      const created = await tx.deliveryAssignment.create({
        data: { consignmentId, employeeId, agencyId: req.agency.id, assignedById: req.user.userId },
        include: assignmentInclude,
      });
      return { assignment: created, created: true };
    });
    return res.status(result.created ? 201 : 200).json({ success: true, data: result.assignment });
  } catch (error) {
    if (isDatabaseConflict(error)) return res.status(409).json({ success: false, message: "Consignment already has an active assignment" });
    return sendControllerError(res, next, error);
  }
}

export async function listAgencyAssignments(req, res, next) {
  try {
    const { active } = req.query;
    if (active !== undefined && !["true", "false"].includes(active)) fail(400, "active must be true or false");
    const assignments = await prisma.deliveryAssignment.findMany({
      where: { agencyId: req.agency.id, ...(active === undefined ? {} : { isActive: active === "true" }) },
      orderBy: { assignedAt: "desc" }, include: assignmentInclude,
    });
    return res.status(200).json({ success: true, data: assignments });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}

export async function getAgencyAssignment(req, res, next) {
  try {
    if (!isUuid(req.params.id)) fail(404, "Assignment not found");
    const assignment = await prisma.deliveryAssignment.findFirst({ where: { id: req.params.id, agencyId: req.agency.id }, include: assignmentInclude });
    if (!assignment) fail(404, "Assignment not found");
    return res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}

export async function listWorkerAssignments(req, res, next) {
  try {
    const assignments = await prisma.deliveryAssignment.findMany({
      where: { employeeId: req.user.userId, agencyId: req.agency.id }, orderBy: { assignedAt: "desc" }, include: assignmentInclude,
    });
    return res.status(200).json({ success: true, data: assignments });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}

export async function getWorkerAssignment(req, res, next) {
  try {
    if (!isUuid(req.params.id)) fail(404, "Assignment not found");
    const assignment = await prisma.deliveryAssignment.findFirst({ where: { id: req.params.id, employeeId: req.user.userId, agencyId: req.agency.id }, include: assignmentInclude });
    if (!assignment) fail(404, "Assignment not found");
    return res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    return sendControllerError(res, next, error);
  }
}
