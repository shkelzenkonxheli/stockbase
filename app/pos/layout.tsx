import { requirePosRole } from "@/lib/pos";
import { WorkspaceBackLink } from "@/app/components/workspace-back-link";

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePosRole(["SUPER_ADMIN", "SELLER"]);

  return (
    <>
      <div className="border-b border-emerald-200 bg-white/95 px-4 py-2 print:hidden sm:px-6">
        <WorkspaceBackLink />
      </div>
      {children}
    </>
  );
}
