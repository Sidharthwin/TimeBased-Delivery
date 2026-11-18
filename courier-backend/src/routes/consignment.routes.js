import express from "express";
import {createConsignment , getConsignment , listAgencyConsignments , trackConsignment , updateConsignmentStatus} from "../controllers/consignment.controller.js";
import authenticateToken from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { authorizeAgencyRoles } from "../middleware/agency.middleware.js";
import publicTrackingRateLimit from "../middleware/publicTrackingRateLimit.js";

const router = express.Router();

router.post(
    "/consignments",
    authenticateToken,
    authorizeRoles("CUSTOMER"),
    createConsignment
);

router.get(
    "/agency/consignments",
    authenticateToken,
    authorizeAgencyRoles("AGENCY_ADMIN", "DISPATCHER"),
    listAgencyConsignments
);

router.patch(
    "/agency/consignments/:id/status",
    authenticateToken,
    authorizeAgencyRoles("AGENCY_ADMIN", "DISPATCHER"),
    updateConsignmentStatus
);

// Keep the tracking path before /consignments/:id so "track" is not treated as an ID.
router.get("/consignments/track/:trackingNumber", publicTrackingRateLimit, trackConsignment);

router.get("/consignments/:id", authenticateToken, getConsignment);

export default router;
