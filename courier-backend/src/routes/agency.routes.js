
import express from "express";
import { createAgency , getAllAgencies , getEmployees, createEmployee, updateEmployeeStatus, createServiceArea, getServiceAreas } from "../controllers/agency.controller.js";
import authenticateToken from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { authorizeAgencyRoles  } from "../middleware/agency.middleware.js";

const router = express.Router();

// previous implemntation
// the problem every route in this router would require a Platform Admin. That would prevent Agency Admins from managing their employees.

// router.use(authenticateToken);// this checks the tokens
// router.use(authorizeRoles("PLATFORM_ADMIN"));// this checks the role == PLATFORM_ADMIN

// router.post("/", createAgency);// THIS GIVES THE ACCESS TO CREATE AGENCY
// router.get("/", getAllAgencies); // This gives the Platform Admin to look to all the agencies details

router.post(
    "/",
    authenticateToken,
    authorizeRoles("PLATFORM_ADMIN"),
    createAgency
);

router.get(
    "/",
    authenticateToken,
    authorizeRoles("PLATFORM_ADMIN"),
    getAllAgencies
);

router.post(
    "/employees",
    authenticateToken,
    authorizeAgencyRoles("AGENCY_ADMIN"),
    createEmployee
);

router.get(
    "/employees",
    authenticateToken,
    authorizeAgencyRoles("AGENCY_ADMIN"),
    getEmployees
);

router.patch(
    "/employees/:id/status",
    authenticateToken,
    authorizeAgencyRoles("AGENCY_ADMIN"),
    updateEmployeeStatus
);

router.post(
    "/service-areas",
    authenticateToken,
    authorizeAgencyRoles("AGENCY_ADMIN"),
    createServiceArea
);

router.get(
    "/service-areas",
    authenticateToken,
    authorizeAgencyRoles("AGENCY_ADMIN"),
    getServiceAreas
);

export default router;
