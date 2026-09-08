import type { Metadata } from "next";
import { UploadedImage } from "@/app/components/uploaded-image";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  AUDIT_ACTION_LABELS,
  getAuditActionLabel,
  getAuditEntityLabel,
  writeAuditLog,
} from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Audit Log",
};

type AuditPageProps = {
  searchParams?: Promise<{
    q?: string;
    action?: string;
    userId?: string;
    from?: string;
    to?: string;
    success?: string;
  }>;
};

type AdjustmentItem = {
  variantId?: number;
  quantity?: number;
  size?: string | null;
  color?: string | null;
};

type AuditMetadata = {
  reason?: string;
  source?: string;
  status?: string;
  quantity?: number;
  totalQuantity?: number;
  itemCount?: number;
  fromWarehouseId?: number;
  toWarehouseId?: number;
  stock?: number;
  reorderLevel?: number | null;
  price?: number;
  material?: string | null;
  powerWatts?: string | null;
  locationCode?: string | null;
  before?: {
    stock?: number;
    locationCode?: string | null;
  };
  after?: {
    stock?: number;
    locationCode?: string | null;
  };
  adjustments?: AdjustmentItem[];
  updates?: AdjustmentItem[];
  items?: Array<AdjustmentItem & { unitPrice?: number }>;
  rows?: Array<AdjustmentItem & { unitPrice?: number }>;
  orderIds?: number[];
  customers?: string[];
  sources?: string[];
  productId?: number;
  email?: string;
  role?: string;
  beforeRole?: string;
  afterRole?: string;
};

type ProductPreview = {
  id: number;
  name: string;
  brand: string | null;
  categoryName: string;
  imagePath: string | null;
};

type VariantPreview = {
  id: number;
  size: string;
  color: string;
  imagePath: string | null;
  product: ProductPreview;
};

function formatMetadata(metadata: unknown) {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

const METADATA_LABELS: Record<string, string> = {
  email: "Email",
  role: "Roli",
  beforeRole: "Roli paraprak",
  afterRole: "Roli i ri",
  reason: "Arsyeja",
  source: "Burimi",
  status: "Statusi",
  quantity: "Sasia",
  totalQuantity: "Sasia totale",
  itemCount: "Artikuj",
  note: "Shenimi",
  warehouseName: "Depoja",
  registerName: "Register",
  openingCash: "Cash fillestar",
  expectedCash: "Cash i pritur",
  countedCash: "Cash i numeruar",
  difference: "Diferenca",
  count: "Numri i hyrjeve",
};

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Po" : "Jo";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.replaceAll("_", " ");
  if (Array.isArray(value)) return `${value.length} rreshta`;
  if (typeof value === "object") {
    const entries: string[] = Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => ["string", "number", "boolean"].includes(typeof nestedValue))
      .slice(0, 3)
      .map(([key, nestedValue]) => `${METADATA_LABELS[key] ?? key}: ${formatMetadataValue(nestedValue)}`);
    return entries.join(" · ") || "Detaje te ruajtura";
  }
  return String(value);
}

function MetadataFacts({ metadata }: { metadata: AuditMetadata }) {
  const entries = Object.entries(metadata as Record<string, unknown>)
    .filter(([key]) => !["adjustments", "updates", "items", "rows", "changes"].includes(key))
    .slice(0, 8);

  if (entries.length === 0) return <span className="text-sm text-slate-400">Pa detaje shtese.</span>;

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {METADATA_LABELS[key] ?? key.replace(/([A-Z])/g, " $1")}
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900">{formatMetadataValue(value)}</p>
        </div>
      ))}
    </div>
  );
}

function parseDateStart(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateEnd(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildAuditReturnUrl(formData: FormData, success?: string) {
  const params = new URLSearchParams();
  for (const key of ["q", "action", "userId", "from", "to"]) {
    const value = formData.get(`return${key[0].toUpperCase()}${key.slice(1)}`)?.toString().trim();
    if (value) params.set(key, value);
  }
  if (success) params.set("success", success);
  return `/audit${params.size ? `?${params.toString()}` : ""}`;
}

async function deleteAuditLogs(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const ids = [...new Set(formData.getAll("selectedLogIds").map((value) => Number(value)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!tenantId || ids.length === 0) redirect(buildAuditReturnUrl(formData));

  await prisma.$transaction(async (tx) => {
    const selectedLogs = await tx.auditLog.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true },
    });
    if (selectedLogs.length === 0) return;

    await tx.auditLog.deleteMany({ where: { tenantId, id: { in: selectedLogs.map((log) => log.id) } } });
    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "AUDIT_LOGS_DELETED",
      entityType: "AUDIT_LOG",
      entityLabel: "Audit entries",
      metadata: { count: selectedLogs.length },
    });
  });

  revalidatePath("/audit");
  redirect(buildAuditReturnUrl(formData, "deleted"));
}

async function deleteOneAuditLog(logId: number, formData: FormData) {
  "use server";

  formData.delete("selectedLogIds");
  if (Number.isInteger(logId) && logId > 0) formData.set("selectedLogIds", String(logId));
  await deleteAuditLogs(formData);
}

function formatWarehouseName(warehouseMap: Map<number, string>, warehouseId?: number) {
  if (!warehouseId) {
    return null;
  }

  return warehouseMap.get(warehouseId) ?? `Depo #${warehouseId}`;
}

function formatReason(reason?: string) {
  if (!reason) {
    return null;
  }

  if (reason === "INCOMING_STOCK") return "Hyrje stoku";
  if (reason === "POS_SALE") return "Shitje POS";
  if (reason === "CUSTOMER_RETURN") return "Kthim klienti";
  if (reason === "SUPPLIER_RETURN") return "Kthim te furnitori";
  if (reason === "TRANSFER") return "Transfer";
  return reason;
}

function formatSource(source?: string) {
  if (!source) {
    return null;
  }

  if (source === "INSTAGRAM") return "Instagram";
  if (source === "STORE") return "Shitore";
  if (source === "WHOLESALE") return "Shumice";
  return source;
}

function VariantRows({
  rows,
}: {
  rows: Array<AdjustmentItem & { unitPrice?: number }>;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
      <div className="grid grid-cols-[minmax(0,1fr)_96px_110px] bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span>Varianti</span>
        <span className="text-center">Sasia</span>
        <span className="text-right">Cmimi</span>
      </div>
      <div className="divide-y divide-slate-100 bg-white">
        {rows.map((row, index) => (
          <div
            key={`${row.variantId ?? "variant"}-${index}`}
            className="grid grid-cols-[minmax(0,1fr)_96px_110px] items-center gap-3 px-3 py-2.5 text-sm"
          >
            <span className="truncate font-semibold text-slate-900">
              {[row.color, row.size].filter(Boolean).join(" / ") || `Variant #${row.variantId ?? "-"}`}
            </span>
            <span className="text-center font-medium text-slate-700">
              {typeof row.quantity === "number" ? `${row.quantity}` : "-"}
            </span>
            <span className="text-right font-medium text-slate-700">
              {typeof row.unitPrice === "number" ? `${row.unitPrice.toFixed(2)} EUR` : "-"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductPreviewCard({
  product,
  variant,
}: {
  product: ProductPreview | null;
  variant?: VariantPreview | null;
}) {
  if (!product) {
    return null;
  }

  const imagePath = variant?.imagePath ?? product.imagePath ?? null;

  return (
    <div className="flex items-center gap-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {imagePath ? (
          <UploadedImage
            src={imagePath}
            alt={product.brand ? `${product.brand} ${product.name}` : product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            IMG
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950 sm:text-base">
          {product.brand ? `${product.brand} ${product.name}` : product.name}
        </p>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
          {product.categoryName}
        </p>
        {variant ? (
          <div className="mt-1.5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
            <span>{variant.color}</span>
            <span className="text-slate-300">/</span>
            <span>{variant.size}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProductTableCell({
  product,
  variant,
}: {
  product: ProductPreview | null;
  variant?: VariantPreview | null;
}) {
  if (!product) {
    return <span className="text-sm text-slate-400">Pa produkt</span>;
  }

  const imagePath = variant?.imagePath ?? product.imagePath ?? null;

  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {imagePath ? (
          <UploadedImage
            src={imagePath}
            alt={product.brand ? `${product.brand} ${product.name}` : product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            IMG
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">
          {product.brand ? `${product.brand} ${product.name}` : product.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{product.categoryName}</p>
        {variant ? (
          <p className="mt-1 text-xs font-medium text-slate-600">
            {variant.color} / {variant.size}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DesktopRows({
  rows,
}: {
  rows: Array<AdjustmentItem & { unitPrice?: number }>;
}) {
  if (rows.length === 0) {
    return <span className="text-sm text-slate-400">-</span>;
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row, index) => (
        <div key={`${row.variantId ?? "variant"}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
          <span className="truncate text-sm font-medium text-slate-800">
            {[row.color, row.size].filter(Boolean).join(" / ") || `Variant #${row.variantId ?? "-"}`}
          </span>
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <span className="font-semibold text-slate-700">
              {typeof row.quantity === "number" ? `${row.quantity} cope` : "-"}
            </span>
            {typeof row.unitPrice === "number" ? (
              <span className="text-slate-500">{row.unitPrice.toFixed(2)} EUR</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function UserAuditDetails({ metadata }: { metadata: AuditMetadata }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <div className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Email</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900">{metadata.email ?? "-"}</p>
      </div>
      <div className="rounded-xl bg-blue-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Roli</p>
        <p className="mt-1 text-sm font-semibold text-blue-900">{metadata.afterRole ?? metadata.role ?? "-"}</p>
      </div>
      <div className="rounded-xl bg-emerald-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Ndryshimi</p>
        <p className="mt-1 text-sm font-semibold text-emerald-900">
          {metadata.beforeRole ? `${metadata.beforeRole} -> ${metadata.afterRole ?? "-"}` : "U ruajt"}
        </p>
      </div>
    </div>
  );
}

function DesktopDetails({
  action,
  metadata,
  warehouseName,
  warehouseMap,
}: {
  action: string;
  metadata: AuditMetadata | null;
  warehouseName: string | null;
  warehouseMap: Map<number, string>;
}) {
  if (!metadata) {
    return <span className="text-sm text-slate-400">-</span>;
  }

  const rows = metadata.adjustments ?? metadata.updates ?? metadata.items ?? metadata.rows ?? [];

  if (action.startsWith("USER_")) {
    return <UserAuditDetails metadata={metadata} />;
  }

  if (action === "STOCK_TRANSFER_CREATED") {
    return (
      <div className="space-y-2">
        <div className="grid gap-2 xl:grid-cols-[180px_180px]">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Nga</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatWarehouseName(warehouseMap, metadata.fromWarehouseId) ?? "-"}
            </p>
          </div>
          <div className="rounded-xl bg-blue-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Ne</p>
            <p className="mt-1 text-sm font-semibold text-blue-900">
              {formatWarehouseName(warehouseMap, metadata.toWarehouseId) ?? "-"}
            </p>
          </div>
        </div>
        <DesktopRows rows={rows} />
      </div>
    );
  }

  if (action === "STOCK_INCOMING_CREATED" || action === "QUICK_STOCK_ADDED") {
    return (
      <div className="space-y-2">
        <div className="grid gap-2 xl:grid-cols-[180px_180px]">
          <div className="rounded-xl bg-blue-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Depoja</p>
            <p className="mt-1 text-sm font-semibold text-blue-900">{warehouseName ?? "-"}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Arsyeja</p>
            <p className="mt-1 text-sm font-semibold text-emerald-900">{formatReason(metadata.reason) ?? "-"}</p>
          </div>
        </div>
        <DesktopRows rows={rows} />
      </div>
    );
  }

  if (action === "QUICK_STOCK_SET") {
    return (
      <div className="grid gap-2 xl:grid-cols-4">
        <div className="rounded-xl bg-blue-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Depoja</p>
          <p className="mt-1 text-sm font-semibold text-blue-900">{warehouseName ?? "-"}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Para</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{metadata.before?.stock ?? "-"}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Pas</p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">{metadata.after?.stock ?? "-"}</p>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-500">Lokacioni</p>
          <p className="mt-1 truncate text-sm font-semibold text-amber-900">{metadata.after?.locationCode ?? "-"}</p>
        </div>
      </div>
    );
  }

  if (action === "ORDER_CREATED") {
    return (
      <div className="space-y-2">
        <div className="grid gap-2 xl:grid-cols-3">
          <div className="rounded-xl bg-blue-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Depoja</p>
            <p className="mt-1 text-sm font-semibold text-blue-900">{warehouseName ?? "-"}</p>
          </div>
          <div className="rounded-xl bg-fuchsia-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-500">Burimi</p>
            <p className="mt-1 text-sm font-semibold text-fuchsia-900">{formatSource(metadata.source) ?? "-"}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Totali</p>
            <p className="mt-1 text-sm font-semibold text-emerald-900">
              {typeof metadata.totalQuantity === "number" ? `${metadata.totalQuantity} cope` : "-"}
            </p>
          </div>
        </div>
        <DesktopRows rows={rows} />
      </div>
    );
  }

  if (action === "ORDER_DELETED" || action === "ORDER_BULK_DELETED") {
    return (
      <div className="grid gap-2 xl:grid-cols-4">
        <div className="rounded-xl bg-blue-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Depoja</p>
          <p className="mt-1 text-sm font-semibold text-blue-900">{warehouseName ?? "-"}</p>
        </div>
        <div className="rounded-xl bg-fuchsia-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-500">Burimi</p>
          <p className="mt-1 text-sm font-semibold text-fuchsia-900">{formatSource(metadata.source) ?? "-"}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sasia</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {typeof metadata.quantity === "number" ? `${metadata.quantity} cope` : "-"}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Rreshtat</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{metadata.itemCount ?? "-"}</p>
        </div>
      </div>
    );
  }

  if (action === "VARIANT_CREATED") {
    return (
      <div className="grid gap-2 xl:grid-cols-4">
        <div className="rounded-xl bg-blue-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Depoja</p>
          <p className="mt-1 text-sm font-semibold text-blue-900">{warehouseName ?? "-"}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Stoku</p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">
            {typeof metadata.stock === "number" ? `${metadata.stock} cope` : "-"}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Cmimi</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {typeof metadata.price === "number" ? `${metadata.price.toFixed(2)} EUR` : "-"}
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-500">Lokacioni</p>
          <p className="mt-1 truncate text-sm font-semibold text-amber-900">{metadata.locationCode ?? "-"}</p>
        </div>
      </div>
    );
  }

  return <MetadataFacts metadata={metadata} />;
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="m5 7.5 5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AuditSummary({
  action,
  metadata,
  warehouseName,
  warehouseMap,
  product,
  variant,
}: {
  action: string;
  metadata: AuditMetadata | null;
  warehouseName: string | null;
  warehouseMap: Map<number, string>;
  product: ProductPreview | null;
  variant?: VariantPreview | null;
}) {
  if (!metadata) {
    return <ProductPreviewCard product={product} variant={variant} />;
  }

  const rows = metadata.adjustments ?? metadata.updates ?? metadata.items ?? metadata.rows ?? [];

  if (action.startsWith("USER_")) {
    return <UserAuditDetails metadata={metadata} />;
  }

  if (action === "STOCK_TRANSFER_CREATED") {
    return (
      <div className="mt-3 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
          <ProductPreviewCard product={product} />
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Nga</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatWarehouseName(warehouseMap, metadata.fromWarehouseId) ?? "-"}
              </p>
            </div>
            <div className="rounded-2xl bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Ne</p>
              <p className="mt-1 text-sm font-semibold text-blue-900">
                {formatWarehouseName(warehouseMap, metadata.toWarehouseId) ?? "-"}
              </p>
            </div>
          </div>
          <VariantRows rows={rows} />
        </div>
      </div>
    );
  }

  if (action === "STOCK_INCOMING_CREATED" || action === "QUICK_STOCK_ADDED") {
    return (
      <div className="mt-3 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
          <ProductPreviewCard product={product} />
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Depoja</p>
              <p className="mt-1 text-sm font-semibold text-blue-900">{warehouseName ?? "-"}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Arsyeja</p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">
                {formatReason(metadata.reason) ?? "-"}
              </p>
            </div>
          </div>
          <VariantRows rows={rows} />
        </div>
      </div>
    );
  }

  if (action === "QUICK_STOCK_SET") {
    return (
      <div className="mt-3 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
          <ProductPreviewCard product={product} variant={variant} />
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-2xl bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Depoja</p>
              <p className="mt-1 text-sm font-semibold text-blue-900">{warehouseName ?? "-"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Para</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{metadata.before?.stock ?? "-"}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Pas</p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">{metadata.after?.stock ?? "-"}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-500">Lokacioni</p>
              <p className="mt-1 truncate text-sm font-semibold text-amber-900">
                {metadata.after?.locationCode ?? "-"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (action === "ORDER_CREATED") {
    return (
      <div className="mt-3 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
          <ProductPreviewCard product={product} />
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Depoja</p>
              <p className="mt-1 text-sm font-semibold text-blue-900">{warehouseName ?? "-"}</p>
            </div>
            <div className="rounded-2xl bg-fuchsia-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-500">Burimi</p>
              <p className="mt-1 text-sm font-semibold text-fuchsia-900">
                {formatSource(metadata.source) ?? "-"}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Totali</p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">
                {typeof metadata.totalQuantity === "number" ? `${metadata.totalQuantity} cope` : "-"}
              </p>
            </div>
          </div>
          <VariantRows rows={rows} />
        </div>
      </div>
    );
  }

  if (action === "ORDER_DELETED" || action === "ORDER_BULK_DELETED") {
    return (
      <div className="mt-3 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
          <ProductPreviewCard product={product} />
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-2xl bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Depoja</p>
              <p className="mt-1 text-sm font-semibold text-blue-900">{warehouseName ?? "-"}</p>
            </div>
            <div className="rounded-2xl bg-fuchsia-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-500">Burimi</p>
              <p className="mt-1 text-sm font-semibold text-fuchsia-900">
                {formatSource(metadata.source) ?? "-"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sasia</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {typeof metadata.quantity === "number" ? `${metadata.quantity} cope` : "-"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Rreshtat</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {typeof metadata.itemCount === "number" ? metadata.itemCount : "-"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (action === "VARIANT_CREATED") {
    return (
      <div className="mt-3 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
          <ProductPreviewCard product={product} variant={variant} />
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-2xl bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Depoja</p>
              <p className="mt-1 text-sm font-semibold text-blue-900">{warehouseName ?? "-"}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Stoku</p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">
                {typeof metadata.stock === "number" ? `${metadata.stock} cope` : "-"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Cmimi</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {typeof metadata.price === "number" ? `${metadata.price.toFixed(2)} EUR` : "-"}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-500">Lokacioni</p>
              <p className="mt-1 truncate text-sm font-semibold text-amber-900">
                {metadata.locationCode ?? "-"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <div className="mt-3"><MetadataFacts metadata={metadata} /></div>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    return null;
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const searchQuery = resolvedSearchParams?.q?.trim() || "";
  const selectedAction = resolvedSearchParams?.action?.trim() || "";
  const selectedUserId = Number(resolvedSearchParams?.userId);
  const from = resolvedSearchParams?.from?.trim() || "";
  const to = resolvedSearchParams?.to?.trim() || "";
  const fromDate = parseDateStart(from);
  const toDate = parseDateEnd(to);
  const hasFilters = Boolean(searchQuery || selectedAction || selectedUserId > 0 || fromDate || toDate);

  const [logs, warehouses, users] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(selectedAction ? { action: selectedAction } : {}),
        ...(selectedUserId > 0 ? { userId: selectedUserId } : {}),
        ...(fromDate || toDate
          ? {
              createdAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        ...(searchQuery
          ? {
              OR: [
                { entityLabel: { contains: searchQuery, mode: "insensitive" } },
                { action: { contains: searchQuery, mode: "insensitive" } },
                { entityType: { contains: searchQuery, mode: "insensitive" } },
                { user: { name: { contains: searchQuery, mode: "insensitive" } } },
                { user: { email: { contains: searchQuery, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        warehouse: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: hasFilters ? 150 : 30,
    }),
    prisma.warehouse.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    }),
    prisma.tenantMembership.findMany({
      where: { tenantId },
      orderBy: { user: { name: "asc" } },
      select: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
  ]);

  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name]));
  const productIds = new Set<number>();
  const variantIds = new Set<number>();

  for (const log of logs) {
    const metadata = (log.metadata ?? null) as AuditMetadata | null;

    if ((log.entityType === "STOCK" || log.entityType === "TRANSFER") && log.entityId) {
      productIds.add(log.entityId);
    }

    if (metadata?.productId) {
      productIds.add(metadata.productId);
    }

    if (log.entityType === "VARIANT" && log.entityId) {
      variantIds.add(log.entityId);
    }

    for (const row of metadata?.adjustments ?? []) {
      if (row.variantId) variantIds.add(row.variantId);
    }
    for (const row of metadata?.updates ?? []) {
      if (row.variantId) variantIds.add(row.variantId);
    }
    for (const row of metadata?.items ?? []) {
      if (row.variantId) variantIds.add(row.variantId);
    }
    for (const row of metadata?.rows ?? []) {
      if (row.variantId) variantIds.add(row.variantId);
    }
  }

  const [products, variants] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: [...productIds] }, tenantId },
      select: {
        id: true,
        name: true,
        brand: true,
        category: { select: { name: true } },
        variants: {
          select: { imagePath: true },
          where: { imagePath: { not: null } },
          take: 1,
        },
      },
    }),
    prisma.variant.findMany({
      where: { id: { in: [...variantIds] }, tenantId },
      select: {
        id: true,
        size: true,
        color: true,
        imagePath: true,
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            category: { select: { name: true } },
            variants: {
              select: { imagePath: true },
              where: { imagePath: { not: null } },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  const productMap = new Map<number, ProductPreview>(
    products.map((product) => [
      product.id,
      {
        id: product.id,
        name: product.name,
        brand: product.brand,
        categoryName: product.category.name,
        imagePath: product.variants[0]?.imagePath ?? null,
      },
    ]),
  );
  const variantMap = new Map<number, VariantPreview>(
    variants.map((variant) => [
      variant.id,
      {
        id: variant.id,
        size: variant.size,
        color: variant.color,
        imagePath: variant.imagePath,
        product: {
          id: variant.product.id,
          name: variant.product.name,
          brand: variant.product.brand,
          categoryName: variant.product.category.name,
          imagePath: variant.product.variants[0]?.imagePath ?? null,
        },
      },
    ]),
  );

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Audit Log
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Aktiviteti i sistemit
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Ketu shfaqen veprimet kryesore te stokut, varianteve dhe porosive per tenant-in aktiv.
          </p>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6">
          <form className="flex items-end gap-4 overflow-x-auto pb-1">
            <label className="grid min-w-0 w-[260px] shrink-0 gap-2 text-sm font-medium text-slate-700">
              Kerko
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="produkt, user, veprim..."
                className="min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300"
              />
            </label>

            <label className="grid min-w-0 w-[180px] shrink-0 gap-2 text-sm font-medium text-slate-700">
              Veprimi
              <select
                name="action"
                defaultValue={selectedAction}
                className="min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300"
              >
                <option value="">Te gjitha</option>
                {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid min-w-0 w-[210px] shrink-0 gap-2 text-sm font-medium text-slate-700">
              Useri
              <select
                name="userId"
                defaultValue={selectedUserId > 0 ? String(selectedUserId) : ""}
                className="min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300"
              >
                <option value="">Te gjithe userat</option>
                {users.map((membership) => (
                  <option key={membership.user.id} value={membership.user.id}>
                    {membership.user.name} - {membership.user.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid min-w-0 w-[155px] shrink-0 gap-2 text-sm font-medium text-slate-700">
              Nga data
              <input type="date" name="from" defaultValue={from} className="min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300" />
            </label>

            <label className="grid min-w-0 w-[155px] shrink-0 gap-2 text-sm font-medium text-slate-700">
              Deri me
              <input type="date" name="to" defaultValue={to} className="min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300" />
            </label>

            <div className="flex shrink-0 gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Filtro
              </button>
              <a
                href="/audit"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Reset
              </a>
            </div>
          </form>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <form action={deleteAuditLogs}>
            <input type="hidden" name="returnQ" value={searchQuery} />
            <input type="hidden" name="returnAction" value={selectedAction} />
            <input type="hidden" name="returnUserId" value={selectedUserId > 0 ? selectedUserId : ""} />
            <input type="hidden" name="returnFrom" value={from} />
            <input type="hidden" name="returnTo" value={to} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 text-sm text-slate-600 sm:px-6">
              <p>
                Po shfaqen <span className="font-semibold text-slate-950">{logs.length}</span> hyrje{hasFilters ? " per filtrat aktive" : " te fundit"}.
              </p>
              <button type="submit" className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
                Fshi te zgjedhurat
              </button>
            </div>
            {resolvedSearchParams?.success === "deleted" ? (
              <p className="mx-5 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 sm:mx-6">
                Hyrjet e zgjedhura u fshine.
              </p>
            ) : null}

          {logs.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Nuk u gjet asnje aktivitet per filtrat aktuale.
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 lg:hidden">
                {logs.map((log) => {
                  const metadata = (log.metadata ?? null) as AuditMetadata | null;
                  const resolvedVariant =
                    (log.entityType === "VARIANT" && log.entityId ? variantMap.get(log.entityId) : null) ??
                    (metadata?.items?.[0]?.variantId ? variantMap.get(metadata.items[0].variantId) : null) ??
                    (metadata?.rows?.[0]?.variantId ? variantMap.get(metadata.rows[0].variantId) : null) ??
                    (metadata?.adjustments?.[0]?.variantId ? variantMap.get(metadata.adjustments[0].variantId) : null) ??
                    (metadata?.updates?.[0]?.variantId ? variantMap.get(metadata.updates[0].variantId) : null) ??
                    null;
                  const resolvedProduct =
                    ((log.entityType === "STOCK" || log.entityType === "TRANSFER") && log.entityId
                      ? productMap.get(log.entityId)
                      : null) ??
                    (metadata?.productId ? productMap.get(metadata.productId) : null) ??
                    resolvedVariant?.product ??
                    null;

                  return (
                    <details key={log.id} className="group px-5 py-3 sm:px-6">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-1 py-2 text-left">
                        <input type="checkbox" name="selectedLogIds" value={log.id} aria-label={`Zgjedh audit ${log.id}`} className="h-4 w-4 shrink-0 rounded border-slate-300 text-rose-600 focus:ring-rose-200" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {getAuditActionLabel(log.action)}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {log.user?.name ?? "Sistem"}
                            {log.user?.email ? ` · ${log.user.email}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-slate-400">
                          <span className="text-xs text-slate-500">
                            {new Date(log.createdAt).toLocaleString("sq-AL")}
                          </span>
                          <span className="transition group-open:rotate-180">
                            <ExpandIcon />
                          </span>
                        </div>
                      </summary>

                      <div className="pb-2 pt-2">
                        <div className="flex flex-wrap items-center gap-2 px-1">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {getAuditEntityLabel(log.entityType)}
                          </span>
                          {log.warehouse?.name ? (
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                              {log.warehouse.name}
                            </span>
                          ) : null}
                        </div>

                        <AuditSummary
                          action={log.action}
                          metadata={metadata}
                          warehouseName={log.warehouse?.name ?? null}
                          warehouseMap={warehouseMap}
                          product={resolvedProduct}
                          variant={resolvedVariant}
                        />
                        <button type="submit" formAction={deleteOneAuditLog.bind(null, log.id)} className="mt-3 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50">
                          Fshi kete hyrje
                        </button>
                      </div>
                    </details>
                  );
                })}
              </div>

              <div className="hidden lg:block">
                <div className="divide-y divide-slate-100">
                  <div className="grid grid-cols-[32px_minmax(0,1.3fr)_minmax(0,1fr)_180px_48px] items-center gap-4 bg-slate-50 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span />
                    <span>Veprimi</span>
                    <span>Kush e beri</span>
                    <span>Koha</span>
                    <span />
                  </div>
                  {logs.map((log) => {
                        const metadata = (log.metadata ?? null) as AuditMetadata | null;
                        const resolvedVariant =
                          (log.entityType === "VARIANT" && log.entityId ? variantMap.get(log.entityId) : null) ??
                          (metadata?.items?.[0]?.variantId ? variantMap.get(metadata.items[0].variantId) : null) ??
                          (metadata?.rows?.[0]?.variantId ? variantMap.get(metadata.rows[0].variantId) : null) ??
                          (metadata?.adjustments?.[0]?.variantId ? variantMap.get(metadata.adjustments[0].variantId) : null) ??
                          (metadata?.updates?.[0]?.variantId ? variantMap.get(metadata.updates[0].variantId) : null) ??
                          null;
                        const resolvedProduct =
                          ((log.entityType === "STOCK" || log.entityType === "TRANSFER") && log.entityId
                            ? productMap.get(log.entityId)
                            : null) ??
                          (metadata?.productId ? productMap.get(metadata.productId) : null) ??
                          resolvedVariant?.product ??
                          null;

                        return (
                          <details key={log.id} className="group">
                            <summary className="grid cursor-pointer list-none grid-cols-[32px_minmax(0,1.3fr)_minmax(0,1fr)_180px_48px] items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50/70">
                              <input type="checkbox" name="selectedLogIds" value={log.id} aria-label={`Zgjedh audit ${log.id}`} className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-200" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-950">
                                  {getAuditActionLabel(log.action)}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                    {getAuditEntityLabel(log.entityType)}
                                  </span>
                                  {log.warehouse?.name ? (
                                    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                                      {log.warehouse.name}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{log.user?.name ?? "Sistem"}</p>
                                <p className="truncate text-xs text-slate-500">{log.user?.email ?? "-"}</p>
                              </div>
                              <span className="text-sm text-slate-500">
                                {new Date(log.createdAt).toLocaleString("sq-AL")}
                              </span>
                              <span className="justify-self-end text-slate-400 transition group-open:rotate-180">
                                <ExpandIcon />
                              </span>
                            </summary>

                            <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                              <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                                  <ProductTableCell product={resolvedProduct} variant={resolvedVariant} />
                                </div>
                                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                                  <DesktopDetails
                                    action={log.action}
                                    metadata={metadata}
                                    warehouseName={log.warehouse?.name ?? null}
                                    warehouseMap={warehouseMap}
                                  />
                                  <button type="submit" formAction={deleteOneAuditLog.bind(null, log.id)} className="mt-3 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50">
                                    Fshi kete hyrje
                                  </button>
                                </div>
                              </div>
                            </div>
                          </details>
                        );
                      })}
                </div>
              </div>
            </>
          )}
          </form>
        </section>
      </div>
    </main>
  );
}
