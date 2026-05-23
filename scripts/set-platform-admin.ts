import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getPasswordPolicyHint, hashPassword, validatePasswordStrength } from "../lib/password";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3] ?? "";

  if (!email || !password) {
    throw new Error(`Usage: npx tsx scripts/set-platform-admin.ts <email> <password>\nPolicy: ${getPasswordPolicyHint()}`);
  }

  const passwordValidationError = validatePasswordStrength(password);
  if (passwordValidationError) {
    throw new Error(passwordValidationError);
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const passwordHash = await hashPassword(password);

  const adapter = new PrismaPg(new Pool({ connectionString }));
  const prisma = new PrismaClient({ adapter });

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      const updated = await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          role: "SUPER_ADMIN",
        },
        select: { id: true, email: true, role: true },
      });

      console.log(JSON.stringify({ action: "updated", user: updated }));
      return;
    }

    const created = await prisma.user.create({
      data: {
        name: "Platform Owner",
        email,
        passwordHash,
        role: "SUPER_ADMIN",
      },
      select: { id: true, email: true, role: true },
    });

    console.log(JSON.stringify({ action: "created", user: created }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
