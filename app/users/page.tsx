import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmActionForm } from "@/app/components/confirm-action-form";
import { FlashMessage } from "@/app/components/flash-message";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getPasswordPolicyHint, hashPassword, validatePasswordStrength } from "@/lib/password";
import { AddUserModal } from "./add-user-modal";
import { EditUserModal } from "./edit-user-modal";
import { ResetPasswordModal } from "./reset-password-modal";

type UsersPageProps = {
  searchParams?: Promise<{
    error?: string;
    success?: string;
    add?: string;
    edit?: string;
    reset?: string;
  }>;
};

async function createUser(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    redirect("/users?error=tenant");
  }

  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const role = formData.get("role")?.toString() as
    | "SUPER_ADMIN"
    | "SELLER"
    | "WAREHOUSE"
    | undefined;

  if (!name || !email || !password || !role) {
    redirect("/users?error=validation");
  }

  const passwordValidationError = validatePasswordStrength(password);
  if (passwordValidationError) {
    redirect(`/users?error=${encodeURIComponent(passwordValidationError)}`);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    redirect("/users?error=email");
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      memberships: {
        create: {
          tenantId,
          role,
        },
      },
    },
  });

  redirect("/users?success=created");
}

async function updateUser(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    redirect("/users?error=tenant");
  }

  const userId = Number(formData.get("userId"));
  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const role = formData.get("role")?.toString() as
    | "SUPER_ADMIN"
    | "SELLER"
    | "WAREHOUSE"
    | undefined;

  if (!userId || !name || !email || !role) {
    redirect(`/users?error=validation&edit=${userId}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { tenantId },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    redirect("/users?error=notfound");
  }

  const tenantMembership = user.memberships[0];

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser && existingUser.id !== userId) {
    redirect(`/users?error=email&edit=${userId}`);
  }

  if (tenantMembership.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
    const superAdminCount = await prisma.tenantMembership.count({
      where: { tenantId, role: "SUPER_ADMIN" },
    });

    if (superAdminCount <= 1) {
      redirect(`/users?error=last-admin&edit=${userId}`);
    }
  }

  if (currentUser.id === userId && currentUser.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
    redirect(`/users?error=self-role&edit=${userId}`);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      role,
      memberships: {
        updateMany: {
          where: { tenantId },
          data: { role },
        },
      },
    },
  });

  redirect("/users?success=updated");
}

async function resetUserPassword(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const userId = Number(formData.get("userId"));
  const password = formData.get("password")?.toString();

  if (!tenantId || !userId || !password) {
    redirect(`/users?error=password&reset=${userId}`);
  }

  const passwordValidationError = validatePasswordStrength(password);
  if (passwordValidationError) {
    redirect(`/users?error=${encodeURIComponent(passwordValidationError)}&reset=${userId}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      memberships: {
        where: { tenantId },
        select: { id: true },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    redirect("/users?error=notfound");
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  redirect("/users?success=password-reset");
}

async function deleteUser(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const userId = Number(formData.get("userId"));

  if (!tenantId || !userId) {
    return;
  }

  if (currentUser.id === userId) {
    redirect("/users?error=self-delete");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      memberships: {
        where: { tenantId },
        select: { id: true, role: true },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    redirect("/users?error=notfound");
  }

  const tenantMembership = user.memberships[0];

  if (tenantMembership.role === "SUPER_ADMIN") {
    const superAdminCount = await prisma.tenantMembership.count({
      where: { tenantId, role: "SUPER_ADMIN" },
    });

    if (superAdminCount <= 1) {
      redirect("/users?error=last-admin");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenantMembership.deleteMany({
      where: { tenantId, userId },
    });

    const remainingMemberships = await tx.tenantMembership.count({
      where: { userId },
    });

    if (remainingMemberships === 0) {
      await tx.user.delete({
        where: { id: userId },
      });
    }
  });

  redirect("/users?success=deleted");
}

function getMessage(error?: string, success?: string) {
  if (error === "validation") {
    return {
      type: "error" as const,
      text: "Ploteso te gjitha fushat dhe vendos password sipas politikes se sigurise.",
    };
  }

  if (error === "email") {
    return {
      type: "error" as const,
      text: "Ky email ekziston tashme ne sistem.",
    };
  }

  if (error === "password") {
    return {
      type: "error" as const,
      text: getPasswordPolicyHint(),
    };
  }

  if (error === "last-admin") {
    return {
      type: "error" as const,
      text: "Nuk mund ta heqesh ose ndryshosh super admin-in e fundit.",
    };
  }

  if (error === "self-delete") {
    return {
      type: "error" as const,
      text: "Nuk mund ta fshish veten nga sistemi.",
    };
  }

  if (error === "self-role") {
    return {
      type: "error" as const,
      text: "Nuk mund ta heqesh rolin tend si SUPER_ADMIN nga kjo llogari.",
    };
  }

  if (error === "notfound") {
    return {
      type: "error" as const,
      text: "Useri nuk u gjet.",
    };
  }

  if (error === "tenant") {
    return {
      type: "error" as const,
      text: "Tenant aktiv nuk u gjet per kete session.",
    };
  }

  if (success === "created") {
    return {
      type: "success" as const,
      text: "Useri u krijua me sukses.",
    };
  }

  if (success === "updated") {
    return {
      type: "success" as const,
      text: "Useri u perditesua me sukses.",
    };
  }

  if (success === "password-reset") {
    return {
      type: "success" as const,
      text: "Password-i u ndryshua me sukses.",
    };
  }

  if (success === "deleted") {
    return {
      type: "success" as const,
      text: "Useri u fshi me sukses.",
    };
  }

  return error
    ? {
        type: "error" as const,
        text: decodeURIComponent(error),
      }
    : null;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    redirect("/login");
  }

  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: true,
    },
  });
  const users = memberships.map((membership) => ({
    ...membership.user,
    role: membership.role,
  }));

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const message = getMessage(
    resolvedSearchParams?.error,
    resolvedSearchParams?.success,
  );
  const editUserId = Number(resolvedSearchParams?.edit);
  const resetUserId = Number(resolvedSearchParams?.reset);
  const editUser =
    Number.isInteger(editUserId) && editUserId > 0
      ? users.find((user) => user.id === editUserId) ?? null
      : null;
  const resetUser =
    Number.isInteger(resetUserId) && resetUserId > 0
      ? users.find((user) => user.id === resetUserId) ?? null
      : null;
  const isAddOpen =
    resolvedSearchParams?.add === "1" ||
    (Boolean(resolvedSearchParams?.error) && !resolvedSearchParams?.edit && !resolvedSearchParams?.reset);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5 sm:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Access Control
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Menaxho userat
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Lista e userave aktive dhe roleve te tyre.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
              >
                Ballina
              </Link>
              <AddUserModal action={createUser} open={isAddOpen} message={message} />
            </div>
          </div>

          {message && !isAddOpen && !editUser && !resetUser ? (
            <FlashMessage
              type={message.type}
              text={message.text}
              className="mx-4 mt-4 rounded-2xl px-4 py-3 text-sm sm:mx-5 lg:mx-6"
            />
          ) : null}

          <div className="grid gap-4 p-4 sm:p-5 lg:hidden">
            {users.map((user) => (
              <article
                key={user.id}
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-slate-950">
                      {user.name}
                    </h2>
                    <p className="mt-1 break-all text-sm text-slate-600">
                      {user.email}
                    </p>
                  </div>
                  <span className="inline-flex rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                    {user.role}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Link
                    href={`/users?edit=${user.id}`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Edito
                  </Link>
                  <Link
                    href={`/users?reset=${user.id}`}
                    className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 transition hover:bg-amber-100"
                  >
                    Password
                  </Link>
                  <ConfirmActionForm
                    action={deleteUser}
                    hiddenFields={[{ name: "userId", value: user.id }]}
                    confirmMessage="A je i sigurt qe don ta fshish kete user?"
                    buttonLabel="Fshi"
                    disabled={user.id === currentUser.id}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-5 py-4">Emri</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Roli</th>
                  <th className="px-5 py-4 text-right">Veprime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-4 font-medium text-slate-950">
                      {user.name}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{user.email}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/users?edit=${user.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          Edito
                        </Link>
                        <Link
                          href={`/users?reset=${user.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 transition hover:bg-amber-100"
                        >
                          Password
                        </Link>
                        <ConfirmActionForm
                          action={deleteUser}
                          hiddenFields={[{ name: "userId", value: user.id }]}
                          confirmMessage="A je i sigurt qe don ta fshish kete user?"
                          buttonLabel="Fshi"
                          disabled={user.id === currentUser.id}
                          className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <EditUserModal action={updateUser} open={Boolean(editUser)} user={editUser} />
        <ResetPasswordModal
          action={resetUserPassword}
          open={Boolean(resetUser)}
          user={resetUser}
        />
      </div>
    </main>
  );
}
