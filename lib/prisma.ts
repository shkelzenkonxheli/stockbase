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
  prismaSchemaVersion: string | undefined;
};

// In development, Prisma can remain cached across a schema migration. Bump this
// value with migrations so an outdated generated client is never reused.
const prismaSchemaVersion = "20260902190251";
const hasCurrentPosDelegates = Boolean(
  globalForPrisma.prisma &&
    "posPayment" in globalForPrisma.prisma &&
    "posCashMovement" in globalForPrisma.prisma &&
    globalForPrisma.prismaSchemaVersion === prismaSchemaVersion,
);

export const prisma =
  globalForPrisma.prisma && hasCurrentPosDelegates
    ? globalForPrisma.prisma
    : new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = prismaSchemaVersion;
}
