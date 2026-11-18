
import prisma from "../config/database.js";
import { AgencyRole } from "../generated/prisma-js/index.js";
import bcrypt from "bcrypt";

export const createAgency = async (req, res, next) => {
    try {
        const { name, slug, admin } = req.body;

        // Validating required fields
        if (!name || !slug || !admin?.name || !admin?.email || !admin?.password) {
            return res.status(400).json({
                success: false,
                message: "All agency and admin fields are required"
            });
        }

        const normalizedSlug = slug.trim().toLowerCase();
        const normalizedEmail = admin.email.trim().toLowerCase();

        if (!normalizedSlug || !name.trim() || !admin.name.trim() ||
            !normalizedEmail || typeof admin.password !== "string" ||
            admin.password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Invalid agency or admin details"
            });
        }

        // Checking whether the agency slug already exists
        const existingAgency = await prisma.courierAgency.findUnique({
            where: { slug: normalizedSlug }
        });

        if (existingAgency) {
            return res.status(409).json({
                success: false,
                message: "Agency slug already exists"
            });
        }

        // Checking whether the admin email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Admin email already exists"
            });
        }

        // Hash the admin password
        const passwordHash = await bcrypt.hash(admin.password, 12);

        // Create agency, user and membership together
        const result = await prisma.$transaction(async (tx) => {
            const agency = await tx.courierAgency.create({
                data: {
                    name: name.trim(),
                    slug: normalizedSlug
                }
            });

            const user = await tx.user.create({
                data: {
                    name: admin.name.trim(),
                    email: normalizedEmail,
                    passwordHash
                }
            });

            const membership = await tx.agencyUser.create({
                data: {
                    userId: user.id,
                    agencyId: agency.id,
                    role: "AGENCY_ADMIN"
                }
            });

            return {
                agency,
                user,
                membership
            };
        });

        return res.status(201).json({
            success: true,
            message: "Courier agency created successfully",
            data: {
                agency: result.agency,
                admin: {
                    id: result.user.id,
                    name: result.user.name,
                    email: result.user.email
                },
                membership: {
                    id: result.membership.id,
                    role: result.membership.role
                }
            }
        });

    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "Agency slug or admin email already exists"
            });
        }

        next(error);
    }
};

export const getAllAgencies = async (req, res, next) => {
    try {
        const agencies = await prisma.courierAgency.findMany({
            orderBy: {
                createdAt: "desc"
            },
            include: {
                _count: {
                    select: {
                        userMemberships: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            count: agencies.length,
            data: agencies
        });

    } catch (error) {
        next(error);
    }
};

export const getEmployees = async (req, res, next) => {
    try {
        const employees = await prisma.agencyUser.findMany({
            where: {
                agencyId: req.agency.id,
                role: {
                    in: [AgencyRole.DISPATCHER, AgencyRole.DELIVERY_WORKER]
                }
            },
            orderBy: {
                createdAt: "desc"
            },
            select: {
                id: true,
                role: true,
                isActive: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            count: employees.length,
            data: employees
        });
    } catch (error) {
        next(error);
    }
};

export const createServiceArea = async (req, res, next) => {
    try {
        const { name, city, state, postalCode } = req.body ?? {};

        if (
            typeof name !== "string" ||
            typeof city !== "string" ||
            typeof state !== "string" ||
            typeof postalCode !== "string" ||
            !name.trim() ||
            !city.trim() ||
            !state.trim() ||
            !/^\d{6}$/.test(postalCode.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, city, state and a six-digit postalCode are required"
            });
        }

        const serviceArea = await prisma.serviceArea.create({
            data: {
                agencyId: req.agency.id,
                name: name.trim(),
                city: city.trim(),
                state: state.trim(),
                postalCode: postalCode.trim()
            }
        });

        return res.status(201).json({
            success: true,
            message: "Service area created successfully",
            data: serviceArea
        });
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "This postal code is already configured for the agency"
            });
        }

        next(error);
    }
};

export const getServiceAreas = async (req, res, next) => {
    try {
        const serviceAreas = await prisma.serviceArea.findMany({
            where: { agencyId: req.agency.id },
            orderBy: { postalCode: "asc" },
            select: {
                id: true,
                agencyId: true,
                name: true,
                city: true,
                state: true,
                postalCode: true,
                createdAt: true,
                updatedAt: true
            }
        });

        return res.status(200).json({
            success: true,
            count: serviceAreas.length,
            data: serviceAreas
        });
    } catch (error) {
        next(error);
    }
};

export const createEmployee = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;

        // 1. Validate input
        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            typeof role !== "string" ||
            !name.trim() ||
            !email.trim() ||
            password.length < 8
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid name, email, password and role are required. Password must be at least 8 characters."
            });
        }

        // 2. Only allow employee roles
        const allowedRoles = [
            AgencyRole.DISPATCHER,
            AgencyRole.DELIVERY_WORKER
        ];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee role"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedName = name.trim();

        // 3. Check whether email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        // 4. Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // 5. Create user and agency membership together
        const result = await prisma.$transaction(async (tx) => {

            const employee = await tx.user.create({
                data: {
                    name: normalizedName,
                    email: normalizedEmail,
                    passwordHash
                }
            });

            const membership = await tx.agencyUser.create({
                data: {
                    userId: employee.id,
                    agencyId: req.agency.id,
                    role
                }
            });

            return { employee, membership };
        });

        // 6. Send response
        return res.status(201).json({
            success: true,
            message: "Employee created successfully",
            data: {
                id: result.employee.id,
                name: result.employee.name,
                email: result.employee.email,
                role: result.membership.role,
                agencyId: result.membership.agencyId
            }
        });

    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        next(error);
    }
};

export const updateEmployeeStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const isActive = req.body?.isActive;

        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            return res.status(404).json({
                success: false,
                message: "Employee membership not found"
            });
        }

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isActive must be a boolean"
            });
        }

        const employeeRoles = [
            AgencyRole.DISPATCHER,
            AgencyRole.DELIVERY_WORKER
        ];

        const membership = await prisma.agencyUser.findFirst({
            where: {
                id,
                agencyId: req.agency.id,
                role: { in: employeeRoles }
            }
        });

        if (!membership) {
            return res.status(404).json({
                success: false,
                message: "Employee membership not found"
            });
        }

        const updatedMembership = await prisma.agencyUser.update({
            where: { id: membership.id },
            data: { isActive },
            select: {
                id: true,
                agencyId: true,
                role: true,
                isActive: true,
                updatedAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: isActive ? "Employee activated" : "Employee deactivated",
            data: updatedMembership
        });
    } catch (error) {
        next(error);
    }
};
