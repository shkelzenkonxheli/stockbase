import { redirect } from "next/navigation";
import { getOpenPosSessionForUser, requirePosRole } from "@/lib/pos";

export default async function PosPage() {
  const currentUser = await requirePosRole(["SUPER_ADMIN", "SELLER"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    redirect("/");
  }

  const openSession = await getOpenPosSessionForUser(tenantId, currentUser.id);

  if (openSession) {
    redirect(`/pos/session/${openSession.id}`);
  }

  redirect("/pos/open");
}
