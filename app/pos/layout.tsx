import { requirePosRole } from "@/lib/pos";

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePosRole(["SUPER_ADMIN", "SELLER"]);

  return children;
}
