import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth";

export default async function AdminEntryPage() {
  const currentUser = await getCurrentUser();

  if (currentUser && isPlatformAdmin(currentUser)) {
    redirect("/platform/tenants");
  }

  redirect("/admin/login");
}
