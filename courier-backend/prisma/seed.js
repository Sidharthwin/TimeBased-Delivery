import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "../src/config/database.js";

async function seedPlatformAdmin() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash,
            platformRole: "PLATFORM_ADMIN"
        },
        create: {
            email,
            passwordHash,
            platformRole: "PLATFORM_ADMIN"
        }
    });

    console.log("Platform admin seed completed.");
}

try {
    await seedPlatformAdmin();
} catch {
    console.error("Platform admin seed failed. Check the admin environment variables and database configuration.");
    process.exitCode = 1;
} finally {
    try {
        await prisma.$disconnect();
    } catch {
        console.error("Prisma Client did not disconnect cleanly.");
        process.exitCode = 1;
    }
}
