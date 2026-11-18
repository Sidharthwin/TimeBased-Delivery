import express from "express";
import { createBooking, cancelBooking, getAgencyBooking, getCustomerBooking, listAgencyBookings, listCustomerBookings, rescheduleBooking } from "../controllers/delivery/bookings.controller.js";
import { assignWorker, getAgencyAssignment, getWorkerAssignment, listAgencyAssignments, listWorkerAssignments } from "../controllers/delivery/assignments.controller.js";
import { listAgencyDeliveryAttempts, listWorkerConsignments, getWorkerConsignment, recordDeliveryAttempt, updateWorkerDeliveryStatus } from "../controllers/delivery/operations.controller.js";
import { createSlot, deactivateSlot, listAgencySlots, listAvailableSlots, updateSlot } from "../controllers/delivery/slots.controller.js";
import authenticateToken from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { authorizeAgencyRoles } from "../middleware/agency.middleware.js";

const router = express.Router();
const agencyManagement = [authenticateToken, authorizeAgencyRoles("AGENCY_ADMIN", "DISPATCHER")];
const agencyAdmin = [authenticateToken, authorizeAgencyRoles("AGENCY_ADMIN")];
const worker = [authenticateToken, authorizeAgencyRoles("DELIVERY_WORKER")];

// Public capacity read used before customers choose a delivery time.
router.get("/delivery-slots/available", listAvailableSlots);

// Agency slot configuration. Dispatchers can read slots but only admins mutate them.
router.post("/agency/delivery-slots", ...agencyAdmin, createSlot);
router.get("/agency/delivery-slots", ...agencyManagement, listAgencySlots);
router.patch("/agency/delivery-slots/:id", ...agencyAdmin, updateSlot);
router.patch("/agency/delivery-slots/:id/deactivate", ...agencyAdmin, deactivateSlot);

// Customer bookings are always scoped to the authenticated customer.
router.post("/bookings", authenticateToken, authorizeRoles("CUSTOMER"), createBooking);
router.get("/bookings", authenticateToken, authorizeRoles("CUSTOMER"), listCustomerBookings);
router.get("/bookings/:id", authenticateToken, authorizeRoles("CUSTOMER"), getCustomerBooking);
router.delete("/bookings/:id", authenticateToken, authorizeRoles("CUSTOMER"), cancelBooking);
router.post("/bookings/:id/reschedule", authenticateToken, authorizeRoles("CUSTOMER"), rescheduleBooking);

// Agency views stay tenant-scoped by the active membership middleware.
router.get("/agency/bookings", ...agencyManagement, listAgencyBookings);
router.get("/agency/bookings/:id", ...agencyManagement, getAgencyBooking);
router.post("/agency/consignments/:consignmentId/assignment", ...agencyManagement, assignWorker);
router.get("/agency/assignments", ...agencyManagement, listAgencyAssignments);
router.get("/agency/assignments/:id", ...agencyManagement, getAgencyAssignment);
router.get("/agency/delivery-attempts", ...agencyManagement, listAgencyDeliveryAttempts);

// Workers can read only assignments and consignments owned by their verified membership.
router.get("/worker/assignments", ...worker, listWorkerAssignments);
router.get("/worker/assignments/:id", ...worker, getWorkerAssignment);
router.get("/worker/consignments", ...worker, listWorkerConsignments);
router.get("/worker/consignments/:id", ...worker, getWorkerConsignment);
router.patch("/worker/consignments/:id/status", ...worker, updateWorkerDeliveryStatus);
router.post("/worker/consignments/:id/attempts", ...worker, recordDeliveryAttempt);

export default router;
