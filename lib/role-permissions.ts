import type { UserRole } from "@/lib/auth";

export type RolePermissionSummary = {
  role: UserRole;
  label: string;
  description: string;
  permissions: string[];
};

export const ROLE_PERMISSION_SUMMARIES: RolePermissionSummary[] = [
  {
    role: "SUPER_ADMIN",
    label: "Admin",
    description: "Menaxhon workspace-in, userat dhe modulet e lejuara.",
    permissions: ["Settings dhe depot", "Userat, audit dhe billing", "Te gjitha modulet e aktivizuara"],
  },
  {
    role: "SELLER",
    label: "Shites",
    description: "Punon me porosi, produkte dhe POS kur ka leje moduli.",
    permissions: ["Porosi dhe Quick Orders", "POS", "Barcode lookup"],
  },
  {
    role: "WAREHOUSE",
    label: "Depo",
    description: "Ka qasje operative te katalogu dhe barcode lookup kur eshte aktiv.",
    permissions: ["Katalogu i produkteve", "Barcode lookup", "Pa Settings, billing ose usera"],
  },
];
