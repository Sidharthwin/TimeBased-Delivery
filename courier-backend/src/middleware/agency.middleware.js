import prisma from "../config/database.js";

export const authorizeAgencyRoles = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            if (!req.user?.userId || !req.user?.agencyId) {
                return res.status(403).json({
                    success: false,
                    message: "Agency access required"
                });
            }

            const membership = await prisma.agencyUser.findUnique({
                where: {
                    userId_agencyId: {
                        userId: req.user.userId,
                        agencyId: req.user.agencyId
                    }
                },
                select: {
                    role: true,
                    isActive: true
                }
            });

            if (!membership || !membership.isActive) {
                return res.status(403).json({
                    success: false,
                    message: "Active agency membership required"
                });
            }

            if (!allowedRoles.includes(membership.role)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized for this agency action"
                });
            }

            req.agency = {
                id: req.user.agencyId,
                role: membership.role
            };

            next();

        } catch (error) {
            next(error);
        }
    };
};
