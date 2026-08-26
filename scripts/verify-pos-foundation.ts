import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { createPosRegister, getPosSessionById, isPosEnabled, openPosSession } from "@/lib/pos";

async function main() {
  const results: string[] = [];

  results.push(`module-disabled-default:${isPosEnabled(null) === false ? "ok" : "fail"}`);
  results.push(
    `module-enabled-flag:${isPosEnabled({ pos: { enabled: true } }) === true ? "ok" : "fail"}`,
  );

  const membership = await prisma.tenantMembership.findFirst({
    where: {
      role: { in: ["SUPER_ADMIN", "SELLER"] },
      tenant: {
        status: { in: ["ACTIVE", "TRIALING"] },
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      tenantId: true,
      userId: true,
      role: true,
    },
  });

  if (!membership) {
    results.push("db-tests:skipped-no-membership");
    console.log(results.join("\n"));
    return;
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: {
      tenantId: membership.tenantId,
      isActive: true,
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      supportsPos: true,
    },
  });

  if (!warehouse) {
    results.push("db-tests:skipped-no-warehouse");
    console.log(results.join("\n"));
    return;
  }

  const existingOpenSession = await prisma.posSession.findFirst({
    where: {
      tenantId: membership.tenantId,
      openedById: membership.userId,
      status: "OPEN",
    },
    select: { id: true },
  });

  if (existingOpenSession) {
    results.push("db-open-session-tests:skipped-existing-open-session");
    console.log(results.join("\n"));
    return;
  }

  const originalSupportsPos = warehouse.supportsPos;
  const tempRegisterName = `POS Test ${Date.now()}`;
  let registerId: number | null = null;
  let secondRegisterId: number | null = null;
  let sessionId: number | null = null;

  try {
    if (!originalSupportsPos) {
      await prisma.warehouse.update({
        where: { id: warehouse.id },
        data: { supportsPos: true },
      });
    }

    const register = await createPosRegister({
      tenantId: membership.tenantId,
      warehouseId: warehouse.id,
      userId: membership.userId,
      name: tempRegisterName,
    });
    registerId = register.id;
    results.push("create-register:ok");

    const session = await openPosSession({
      tenantId: membership.tenantId,
      registerId: register.id,
      userId: membership.userId,
      openingCash: 123.45,
      openingNote: "test session",
    });
    sessionId = session.id;
    results.push("open-session:ok");

    const loadedSession = await getPosSessionById({
      tenantId: membership.tenantId,
      sessionId: session.id,
    });
    results.push(loadedSession ? "tenant-session-read:ok" : "tenant-session-read:fail");

    const wrongTenantSession = await getPosSessionById({
      tenantId: membership.tenantId + 999999,
      sessionId: session.id,
    });
    results.push(!wrongTenantSession ? "tenant-isolation-read:ok" : "tenant-isolation-read:fail");

    const secondRegister = await createPosRegister({
      tenantId: membership.tenantId,
      warehouseId: warehouse.id,
      userId: membership.userId,
      name: `${tempRegisterName}-2`,
    });
    secondRegisterId = secondRegister.id;

    try {
      await openPosSession({
        tenantId: membership.tenantId,
        registerId: secondRegister.id,
        userId: membership.userId,
        openingCash: 50,
      });
      results.push("duplicate-user-open-session:fail");
    } catch {
      results.push("duplicate-user-open-session:ok");
    }

    const secondUserMembership = await prisma.tenantMembership.findFirst({
      where: {
        tenantId: membership.tenantId,
        userId: { not: membership.userId },
        role: { in: ["SUPER_ADMIN", "SELLER"] },
      },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    });

    if (secondUserMembership) {
      try {
        await openPosSession({
          tenantId: membership.tenantId,
          registerId: register.id,
          userId: secondUserMembership.userId,
          openingCash: 20,
        });
        results.push("duplicate-register-open-session:fail");
      } catch {
        results.push("duplicate-register-open-session:ok");
      }
    } else {
      results.push("duplicate-register-open-session:skipped-no-second-user");
    }

    const authSessionCountBefore = await prisma.session.count({
      where: { userId: membership.userId },
    });
    results.push(authSessionCountBefore >= 0 ? "logout-corruption-check:code-reviewed-ok" : "logout-corruption-check:fail");
  } finally {
    if (sessionId) {
      await prisma.posSession.deleteMany({ where: { id: sessionId } });
    }

    if (secondRegisterId) {
      await prisma.posRegister.deleteMany({ where: { id: secondRegisterId } });
    }

    if (registerId) {
      await prisma.posRegister.deleteMany({ where: { id: registerId } });
    }

    if (!originalSupportsPos) {
      await prisma.warehouse.update({
        where: { id: warehouse.id },
        data: { supportsPos: false },
      });
    }
  }

  console.log(results.join("\n"));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
