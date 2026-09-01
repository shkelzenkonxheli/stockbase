import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const adapter = new PrismaPg(new Pool({ connectionString }));

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// In development, Prisma can remain cached across a schema migration. Recreate an
// outdated client instead of keeping a delegate set that predates the current schema.
const hasCurrentPosDelegates = Boolean(
  globalForPrisma.prisma &&
    "posPayment" in globalForPrisma.prisma &&
    "posCashMovement" in globalForPrisma.prisma,
);

export const prisma =
  globalForPrisma.prisma && hasCurrentPosDelegates
    ? globalForPrisma.prisma
    : new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
