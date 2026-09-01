import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit-log";
import { getCurrentUser, hasRole, requireRole, type AuthUser, type UserRole } from "@/lib/auth";
import { getPosConfig, type TenantCatalogConfig } from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isPosEnabled(tenantConfig?: TenantCatalogConfig | null) {
  return getPosConfig(tenantConfig).enabled;
}

export async function requirePosRole(roles: UserRole[] = ["SUPER_ADMIN", "SELLER"]) {
  const currentUser = await requireRole(roles);

  if (!currentUser.tenant || !isPosEnabled(currentUser.tenant.catalogConfig)) {
    redirect("/");
  }

  return currentUser;
}

export async function requirePosAdmin() {
  return requirePosRole(["SUPER_ADMIN"]);
}

export async function getPosApiContext(roles: UserRole[] = ["SUPER_ADMIN", "SELLER"]) {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant?.id ?? null;

  if (!currentUser || !tenantId || !hasRole(currentUser, roles) || !isPosEnabled(currentUser.tenant?.catalogConfig)) {
    return null;
  }

  return {
    currentUser,
    tenantId,
  };
}

async function buildUniqueRegisterSlug(
  tenantId: number,
  name: string,
  excludedRegisterId?: number,
) {
  const baseSlug = slugify(name) || "register";
  let slug = baseSlug;
  let suffix = 2;

  while (
    await prisma.posRegister.findFirst({
      where: {
        tenantId,
        slug,
        ...(excludedRegisterId ? { id: { not: excludedRegisterId } } : {}),
      },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function getTenantPosLocations(tenantId: number) {
  return prisma.warehouse.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      supportsPos: true,
      _count: {
        select: {
          posRegisters: true,
        },
      },
    },
  });
}

export async function getTenantPosRegisters(tenantId: number) {
  return prisma.posRegister.findMany({
    where: { tenantId },
    orderBy: [{ isActive: "desc" }, { warehouse: { name: "asc" } }, { name: "asc" }],
    include: {
      warehouse: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          supportsPos: true,
        },
      },
      sessions: {
        where: { status: "OPEN" },
        select: {
          id: true,
          openedAt: true,
          openedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        take: 1,
        orderBy: { openedAt: "desc" },
      },
      _count: {
        select: {
          sessions: true,
        },
      },
    },
  });
}

export async function setPosLocationSupport(input: {
  tenantId: number;
  warehouseId: number;
  userId?: number | null;
  supportsPos: boolean;
}) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, tenantId: input.tenantId },
    select: {
      id: true,
      name: true,
      isActive: true,
      supportsPos: true,
      _count: {
        select: {
          posRegisters: true,
        },
      },
    },
  });

  if (!warehouse) {
    throw new Error("Lokacioni nuk u gjet.");
  }

  if (!warehouse.isActive) {
    throw new Error("Vetem lokacionet aktive mund te perdoren ne POS.");
  }

  if (!input.supportsPos && warehouse._count.posRegisters > 0) {
    throw new Error("Largo ose caktivizo register-at para se ta heqesh kete lokacion nga POS.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.warehouse.update({
      where: { id: warehouse.id },
      data: { supportsPos: input.supportsPos },
    });

    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: "POS_LOCATION_UPDATED",
      entityType: "WAREHOUSE",
      entityId: updated.id,
      entityLabel: updated.name,
      warehouseId: updated.id,
      metadata: {
        supportsPos: updated.supportsPos,
      },
    });

    return updated;
  });
}

export async function createPosRegister(input: {
  tenantId: number;
  warehouseId: number;
  userId?: number | null;
  name: string;
}) {
  const name = normalizeName(input.name);
  if (!name) {
    throw new Error("Emri i register-it eshte i detyrueshem.");
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: {
      id: input.warehouseId,
      tenantId: input.tenantId,
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      supportsPos: true,
    },
  });

  if (!warehouse) {
    throw new Error("Lokacioni POS nuk u gjet.");
  }

  if (!warehouse.isActive) {
    throw new Error("Lokacioni duhet te jete aktiv.");
  }

  if (!warehouse.supportsPos) {
    throw new Error("Aktivizo me pare lokacionin per POS.");
  }

  const duplicate = await prisma.posRegister.findFirst({
    where: {
      warehouseId: input.warehouseId,
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("Ky register ekziston tashme ne kete lokacion.");
  }

  const slug = await buildUniqueRegisterSlug(input.tenantId, `${warehouse.name}-${name}`);

  return prisma.$transaction(async (tx) => {
    const register = await tx.posRegister.create({
      data: {
        tenantId: input.tenantId,
        warehouseId: input.warehouseId,
        name,
        slug,
        isActive: true,
      },
    });

    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: "POS_REGISTER_CREATED",
      entityType: "POS_REGISTER",
      entityId: register.id,
      entityLabel: register.name,
      warehouseId: input.warehouseId,
      metadata: {
        warehouseName: warehouse.name,
      },
    });

    return register;
  });
}

export async function updatePosRegister(input: {
  tenantId: number;
  registerId: number;
  warehouseId: number;
  userId?: number | null;
  name: string;
  isActive: boolean;
}) {
  const name = normalizeName(input.name);
  if (!name) {
    throw new Error("Emri i register-it eshte i detyrueshem.");
  }

  const [register, warehouse] = await Promise.all([
    prisma.posRegister.findFirst({
      where: { id: input.registerId, tenantId: input.tenantId },
      select: {
        id: true,
        name: true,
        warehouseId: true,
        isActive: true,
        sessions: {
          where: { status: "OPEN" },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.warehouse.findFirst({
      where: { id: input.warehouseId, tenantId: input.tenantId },
      select: {
        id: true,
        name: true,
        isActive: true,
        supportsPos: true,
      },
    }),
  ]);

  if (!register) {
    throw new Error("Register-i nuk u gjet.");
  }

  if (!warehouse) {
    throw new Error("Lokacioni nuk u gjet.");
  }

  if (!warehouse.isActive || !warehouse.supportsPos) {
    throw new Error("Lokacioni i zgjedhur duhet te jete aktiv dhe i lejuar per POS.");
  }

  if (!input.isActive && register.sessions.length > 0) {
    throw new Error("Nuk mund ta caktivizosh nje register me session aktiv.");
  }

  const duplicate = await prisma.posRegister.findFirst({
    where: {
      warehouseId: input.warehouseId,
      id: { not: input.registerId },
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("Ekziston nje register tjeter me kete emer ne kete lokacion.");
  }

  const slug = await buildUniqueRegisterSlug(input.tenantId, `${warehouse.name}-${name}`, input.registerId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.posRegister.update({
      where: { id: input.registerId },
      data: {
        warehouseId: input.warehouseId,
        name,
        slug,
        isActive: input.isActive,
      },
    });

    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: "POS_REGISTER_UPDATED",
      entityType: "POS_REGISTER",
      entityId: updated.id,
      entityLabel: updated.name,
      warehouseId: updated.warehouseId,
    });

    return updated;
  });
}

export async function getOpenPosSessionForUser(tenantId: number, userId: number) {
  return prisma.posSession.findFirst({
    where: {
      tenantId,
      openedById: userId,
      status: "OPEN",
    },
    include: {
      register: {
        include: {
          warehouse: true,
        },
      },
      openedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { openedAt: "desc" },
  });
}

export async function getPosSessionById(input: {
  tenantId: number;
  sessionId: number;
}) {
  return prisma.posSession.findFirst({
    where: {
      id: input.sessionId,
      tenantId: input.tenantId,
    },
    include: {
      register: {
        include: {
          warehouse: true,
        },
      },
      openedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      closedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function openPosSession(input: {
  tenantId: number;
  registerId: number;
  userId: number;
  openingCash: number;
  openingNote?: string | null;
}) {
  if (!Number.isFinite(input.openingCash) || input.openingCash < 0) {
    throw new Error("Opening cash duhet te jete numer valid >= 0.");
  }

  return prisma.$transaction(async (tx) => {
    const [register, openByUser, openOnRegister] = await Promise.all([
      tx.posRegister.findFirst({
        where: {
          id: input.registerId,
          tenantId: input.tenantId,
          isActive: true,
          warehouse: {
            isActive: true,
            supportsPos: true,
          },
        },
        select: {
          id: true,
          name: true,
          warehouseId: true,
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      tx.posSession.findFirst({
        where: {
          tenantId: input.tenantId,
          openedById: input.userId,
          status: "OPEN",
        },
        select: {
          id: true,
          register: {
            select: { name: true },
          },
        },
      }),
      tx.posSession.findFirst({
        where: {
          tenantId: input.tenantId,
          registerId: input.registerId,
          status: "OPEN",
        },
        select: {
          id: true,
          openedBy: {
            select: { name: true },
          },
        },
      }),
    ]);

    if (!register) {
      throw new Error("Register-i nuk u gjet ose nuk eshte aktiv per POS.");
    }

    if (openByUser) {
      throw new Error(`Ky user ka tashme nje session aktiv te register-i ${openByUser.register.name}.`);
    }

    if (openOnRegister) {
      throw new Error(`Ky register eshte tashme i hapur nga ${openOnRegister.openedBy.name}.`);
    }

    const session = await tx.posSession.create({
      data: {
        tenantId: input.tenantId,
        registerId: register.id,
        warehouseId: register.warehouseId,
        openedById: input.userId,
        status: "OPEN",
        openingCash: new Prisma.Decimal(input.openingCash.toFixed(2)),
        openingNote: input.openingNote?.trim() || null,
      },
    });

    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      userId: input.userId,
      action: "POS_SESSION_OPENED",
      entityType: "POS_SESSION",
      entityId: session.id,
      entityLabel: register.name,
      warehouseId: register.warehouseId,
      metadata: {
        registerId: register.id,
        registerName: register.name,
        warehouseName: register.warehouse.name,
        openingCash: Number(session.openingCash),
      },
    });

    return session;
  });
}

export async function closePosSession(input: {
  tenantId: number;
  sessionId: number;
  userId: number;
  userRole: UserRole;
  countedCash: number;
  closingNote?: string | null;
}) {
  if (!Number.isFinite(input.countedCash) || input.countedCash < 0) {
    throw new Error("Counted cash duhet te jete numer valid >= 0.");
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.posSession.findFirst({
      where: {
        id: input.sessionId,
        tenantId: input.tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        registerId: true,
        warehouseId: true,
        openedById: true,
        status: true,
        openingCash: true,
        register: {
          select: {
            id: true,
            name: true,
            warehouse: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new Error("POS session nuk u gjet.");
    }

    if (session.status !== "OPEN") {
      throw new Error("Ky POS session eshte mbyllur tashme.");
    }

    if (input.userRole !== "SUPER_ADMIN" && session.openedById !== input.userId) {
      throw new Error("Nuk ke leje ta mbyllesh kete session.");
    }

    const [cashPayments, cashMovements] = await Promise.all([
      tx.posPayment.aggregate({
        where: {
          tenantId: input.tenantId,
          posSessionId: session.id,
          method: "CASH",
        },
        _sum: {
          amount: true,
        },
      }),
      tx.posCashMovement.groupBy({
        by: ["type"],
        where: { tenantId: input.tenantId, posSessionId: session.id },
        _sum: { amount: true },
      }),
    ]);
    const cashIn = Number(cashMovements.find((movement) => movement.type === "CASH_IN")?._sum.amount ?? 0);
    const cashOut = Number(cashMovements.find((movement) => movement.type === "CASH_OUT")?._sum.amount ?? 0);
    const expectedCash = Number(session.openingCash) + Number(cashPayments._sum.amount ?? 0) + cashIn - cashOut;
    const countedCash = Number(input.countedCash.toFixed(2));
    const difference = Number((countedCash - expectedCash).toFixed(2));

    const updated = await tx.posSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedById: input.userId,
        closedAt: new Date(),
        expectedCash: new Prisma.Decimal(expectedCash.toFixed(2)),
        countedCash: new Prisma.Decimal(countedCash.toFixed(2)),
        closingNote: input.closingNote?.trim() || null,
      },
    });

    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      userId: input.userId,
      action: "POS_SESSION_CLOSED",
      entityType: "POS_SESSION",
      entityId: updated.id,
      entityLabel: session.register.name,
      warehouseId: session.warehouseId,
      metadata: {
        registerId: session.registerId,
        registerName: session.register.name,
        warehouseName: session.register.warehouse.name,
        expectedCash,
        countedCash,
        difference,
      },
    });

    return updated;
  });
}

export async function createPosCashMovement(input: {
  tenantId: number;
  sessionId: number;
  userId: number;
  userRole: UserRole;
  type: "CASH_IN" | "CASH_OUT";
  amount: number;
  note?: string | null;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Shuma duhet te jete me e madhe se 0.");
  }

  const note = input.note?.trim() || null;
  if (note && note.length > 300) {
    throw new Error("Shenimi mund te kete deri ne 300 karaktere.");
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.posSession.findFirst({
      where: { id: input.sessionId, tenantId: input.tenantId },
      select: {
        id: true,
        status: true,
        openedById: true,
        warehouseId: true,
        register: { select: { name: true } },
      },
    });

    if (!session) throw new Error("POS session nuk u gjet.");
    if (session.status !== "OPEN") throw new Error("Nuk mund te shtosh levizje ne nje session te mbyllur.");
    if (input.userRole !== "SUPER_ADMIN" && session.openedById !== input.userId) {
      throw new Error("Nuk ke leje per levizje cash ne kete session.");
    }

    const movement = await tx.posCashMovement.create({
      data: {
        tenantId: input.tenantId,
        posSessionId: session.id,
        createdById: input.userId,
        type: input.type,
        amount: new Prisma.Decimal(input.amount.toFixed(2)),
        note,
      },
    });

    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      userId: input.userId,
      action: input.type,
      entityType: "POS_CASH_MOVEMENT",
      entityId: movement.id,
      entityLabel: session.register.name,
      warehouseId: session.warehouseId,
      metadata: { posSessionId: session.id, amount: Number(movement.amount), note },
    });

    return movement;
  });
}

export function formatMoney(value: Prisma.Decimal | number | string) {
  const numeric = Number(value);
  return `${numeric.toFixed(2)} EUR`;
}

export async function canAccessPosSession(currentUser: AuthUser, sessionId: number) {
  const tenantId = currentUser.tenant?.id;
  if (!tenantId) {
    return null;
  }

  const session = await getPosSessionById({ tenantId, sessionId });
  if (!session) {
    return null;
  }

  if (currentUser.role === "SUPER_ADMIN") {
    return session;
  }

  return session.openedById === currentUser.id ? session : null;
}
