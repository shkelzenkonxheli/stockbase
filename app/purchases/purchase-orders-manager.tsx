"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SupplierOption = {
  id: number;
  name: string;
};

type WarehouseOption = {
  id: number;
  name: string;
};

type CatalogVariant = {
  id: number;
  size: string;
  color: string;
  price: number;
};

type CatalogProduct = {
  id: number;
  name: string;
  brand: string | null;
  categoryName: string;
  variants: CatalogVariant[];
};

type PurchaseOrderListItem = {
  id: number;
  status: string;
  note: string | null;
  orderedAtLabel: string;
  supplierName: string;
  warehouseName: string;
  totalLabel: string;
  itemCount: number;
  totalQuantity: number;
  items: Array<{
    id: number;
    productName: string;
    size: string;
    color: string;
    orderedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
    unitCostLabel: string;
    lineTotalLabel: string;
  }>;
};

type DraftLine = {
  key: string;
  identityKey: string;
  variantId: number | null;
  productId: number;
  size: string;
  color: string;
  quantity: number;
  unitCost: string;
  note: string;
  isCustom?: boolean;
};

type DraftGroup = {
  id: string;
  productId: number;
  productName: string;
  brand: string | null;
  categoryName: string;
  color: string;
  lines: DraftLine[];
};

type PurchaseOrdersManagerProps = {
  action: (formData: FormData) => void | Promise<void>;
  receiveAction: (formData: FormData) => void | Promise<void>;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  products: CatalogProduct[];
  purchaseOrders: PurchaseOrderListItem[];
  searchQuery: string;
  statusFilter: string;
};

const FOOTWEAR_CATEGORIES = new Set(["Patika", "Kepuce", "Sandale"]);

function createGroupId() {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDraftIdentityKey(productId: number, size: string, color: string) {
  return [
    productId,
    color.trim().toLowerCase(),
    size.trim().toLowerCase() || "standard",
  ].join("::");
}

function statusClasses(status: string) {
  switch (status) {
    case "ORDERED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "PARTIALLY_RECEIVED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "RECEIVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "CANCELED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "ORDERED":
      return "Ordered";
    case "PARTIALLY_RECEIVED":
      return "Partial";
    case "RECEIVED":
      return "Received";
    case "CANCELED":
      return "Canceled";
    default:
      return "Draft";
  }
}

function formatCurrency(value: number) {
  return `${value.toFixed(2)} EUR`;
}

function SectionTitleIcon({
  children,
  accent = "emerald",
}: {
  children: React.ReactNode;
  accent?: "emerald" | "slate";
}) {
  const className =
    accent === "emerald"
      ? "inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
      : "inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-slate-200";

  return <span className={className}>{children}</span>;
}

function sectionCardClass() {
  return "rounded-[26px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.045)]";
}

export function PurchaseOrdersManager({
  action,
  receiveAction,
  suppliers,
  warehouses,
  products,
  purchaseOrders,
  searchQuery,
  statusFilter,
}: PurchaseOrdersManagerProps) {
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const detailsDialogRef = useRef<HTMLDialogElement>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState("ORDERED");
  const [orderedAt, setOrderedAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectionMap, setSelectionMap] = useState<Record<string, DraftLine>>({});
  const [customSize, setCustomSize] = useState("");
  const [draftGroups, setDraftGroups] = useState<DraftGroup[]>([]);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (!dialog) {
      return;
    }

    if (isCreateOpen && !dialog.open) {
      dialog.showModal();
    }

    if (!isCreateOpen && dialog.open) {
      dialog.close();
    }
  }, [isCreateOpen]);

  useEffect(() => {
    const dialog = detailsDialogRef.current;
    if (!dialog) {
      return;
    }

    if (selectedOrderId && !dialog.open) {
      dialog.showModal();
    }

    if (!selectedOrderId && dialog.open) {
      dialog.close();
    }
  }, [selectedOrderId]);

  const selectedOrder = useMemo(
    () => purchaseOrders.find((order) => order.id === selectedOrderId) ?? null,
    [purchaseOrders, selectedOrderId],
  );

  const categories = useMemo(
    () =>
      [...new Set(products.map((product) => product.categoryName))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [products],
  );

  const productsInCategory = useMemo(
    () =>
      selectedCategory
        ? products.filter((product) => product.categoryName === selectedCategory)
        : [],
    [products, selectedCategory],
  );

  const brandOptions = useMemo(
    () =>
      [
        ...new Set(
          productsInCategory
            .map((product) => product.brand?.trim())
            .filter(Boolean) as string[],
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [productsInCategory],
  );

  const shouldShowBrand = brandOptions.length > 0;

  const productOptions = useMemo(() => {
    return productsInCategory
      .filter((product) =>
        shouldShowBrand && selectedBrand ? product.brand === selectedBrand : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [productsInCategory, selectedBrand, shouldShowBrand]);

  const selectedProduct = useMemo(
    () => productOptions.find((product) => product.id === Number(selectedProductId)) ?? null,
    [productOptions, selectedProductId],
  );

  const colorOptions = useMemo(
    () =>
      selectedProduct
        ? [...new Set(selectedProduct.variants.map((variant) => variant.color))].sort((a, b) =>
            a.localeCompare(b),
          )
        : [],
    [selectedProduct],
  );

  const usedVariantKeys = useMemo(
    () => new Set(draftGroups.flatMap((group) => group.lines.map((line) => line.identityKey))),
    [draftGroups],
  );

  const activeVariants = useMemo(() => {
    if (!selectedProduct || !selectedColor) {
      return [];
    }

    return selectedProduct.variants
      .filter((variant) => variant.color === selectedColor)
      .sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true }));
  }, [selectedProduct, selectedColor]);

  const isFootwear = selectedProduct
    ? FOOTWEAR_CATEGORIES.has(selectedProduct.categoryName)
    : false;

  const itemsPayload = useMemo(
    () =>
      JSON.stringify(
        draftGroups.flatMap((group) =>
          group.lines.map((line) => ({
            variantId: line.variantId,
            productId: line.productId,
            size: line.size,
            color: line.color,
            quantity: line.quantity,
            unitCost: Number(line.unitCost || 0),
            note: line.note,
          })),
        ),
      ),
    [draftGroups],
  );

  const draftSummary = useMemo(() => {
    const lineCount = draftGroups.reduce((sum, group) => sum + group.lines.length, 0);
    const totalQuantity = draftGroups.reduce(
      (sum, group) =>
        sum + group.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
      0,
    );
    const subtotal = draftGroups.reduce(
      (sum, group) =>
        sum +
        group.lines.reduce(
          (lineSum, line) => lineSum + line.quantity * Number(line.unitCost || 0),
          0,
        ),
      0,
    );

    return { lineCount, totalQuantity, subtotal };
  }, [draftGroups]);

  const selectionCount = Object.keys(selectionMap).length;

  function resetActivePicker() {
    setSelectedCategory("");
    setSelectedBrand("");
    setSelectedProductId("");
    setSelectedColor("");
    setSelectionMap({});
    setCustomSize("");
  }

  function resetCreateState() {
    setSupplierId("");
    setWarehouseId("");
    setStatus("ORDERED");
    setOrderedAt(new Date().toISOString().slice(0, 10));
    setNote("");
    resetActivePicker();
    setDraftGroups([]);
  }

  function closeCreateModal() {
    setIsCreateOpen(false);
  }

  function openCreateModal() {
    resetCreateState();
    setIsCreateOpen(true);
  }

  function closeDetailsModal() {
    setSelectedOrderId(null);
  }

  function handleCategoryChange(value: string) {
    setSelectedCategory(value);
    setSelectedBrand("");
    setSelectedProductId("");
    setSelectedColor("");
    setSelectionMap({});
    setCustomSize("");
  }

  function handleBrandChange(value: string) {
    setSelectedBrand(value);
    setSelectedProductId("");
    setSelectedColor("");
    setSelectionMap({});
    setCustomSize("");
  }

  function handleProductChange(value: string) {
    setSelectedProductId(value);
    setSelectedColor("");
    setSelectionMap({});
    setCustomSize("");
  }

  function handleColorChange(value: string) {
    setSelectedColor(value);
    setSelectionMap({});
    setCustomSize("");
  }

  function toggleVariantSelection(variant: CatalogVariant) {
    setSelectionMap((current) => {
      const lineKey = buildDraftIdentityKey(
        selectedProduct?.id ?? 0,
        variant.size,
        variant.color,
      );

      if (current[lineKey]) {
        const next = { ...current };
        delete next[lineKey];
        return next;
      }

      return {
        ...current,
        [lineKey]: {
          key: lineKey,
          identityKey: lineKey,
          variantId: variant.id,
          productId: selectedProduct?.id ?? 0,
          size: variant.size,
          color: variant.color,
          quantity: 1,
          unitCost: variant.price.toFixed(2),
          note: "",
        },
      };
    });
  }

  function updateSelectedLine(
    lineKey: string,
    field: "quantity" | "unitCost" | "note",
    value: string,
  ) {
    setSelectionMap((current) => {
      const existing = current[lineKey];
      if (!existing) {
        return current;
      }

      return {
        ...current,
        [lineKey]:
          field === "quantity"
            ? { ...existing, quantity: Math.max(1, Number(value) || 1) }
            : field === "unitCost"
              ? { ...existing, unitCost: value }
              : { ...existing, note: value },
      };
    });
  }

  function addCustomSizeSelection() {
    if (!selectedProduct || !selectedColor) {
      return;
    }

    const normalizedSize = customSize.trim();
    if (!normalizedSize) {
      return;
    }

    const lineKey = buildDraftIdentityKey(selectedProduct.id, normalizedSize, selectedColor);
    if (usedVariantKeys.has(lineKey)) {
      return;
    }

    setSelectionMap((current) => {
      if (current[lineKey]) {
        return current;
      }

      return {
        ...current,
        [lineKey]: {
          key: lineKey,
          identityKey: lineKey,
          variantId: null,
          productId: selectedProduct.id,
          size: normalizedSize,
          color: selectedColor,
          quantity: 1,
          unitCost: activeVariants[0]?.price?.toFixed(2) ?? "0.00",
          note: "",
          isCustom: true,
        },
      };
    });

    setCustomSize("");
  }

  function addCurrentSelection() {
    if (!selectedProduct || !selectedColor) {
      return;
    }

    const lines = Object.values(selectionMap).filter(
      (line) => !usedVariantKeys.has(line.identityKey),
    );
    if (lines.length === 0) {
      return;
    }

    setDraftGroups((current) => [
      ...current,
      {
        id: createGroupId(),
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        brand: selectedProduct.brand,
        categoryName: selectedProduct.categoryName,
        color: selectedColor,
        lines,
      },
    ]);

    setSelectedProductId("");
    setSelectedColor("");
    setSelectionMap({});
  }

  function removeGroup(groupId: string) {
    setDraftGroups((current) => current.filter((group) => group.id !== groupId));
  }

  function removeDraftLine(groupId: string, variantId: number) {
    setDraftGroups((current) =>
      current
        .map((group) =>
          group.id === groupId
            ? { ...group, lines: group.lines.filter((line) => line.variantId !== variantId) }
            : group,
        )
        .filter((group) => group.lines.length > 0),
    );
  }

  function removeDraftLineByKey(groupId: string, lineKey: string) {
    setDraftGroups((current) =>
      current
        .map((group) =>
          group.id === groupId
            ? { ...group, lines: group.lines.filter((line) => line.key !== lineKey) }
            : group,
        )
        .filter((group) => group.lines.length > 0),
    );
  }

  function updateDraftLine(
    groupId: string,
    lineKey: string,
    field: "quantity" | "unitCost" | "note",
    value: string,
  ) {
    setDraftGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) {
          return group;
        }

        return {
          ...group,
          lines: group.lines.map((line) =>
            line.key === lineKey
              ? {
                  ...line,
                  quantity:
                    field === "quantity" ? Math.max(1, Number(value) || 1) : line.quantity,
                  unitCost: field === "unitCost" ? value : line.unitCost,
                  note: field === "note" ? value : line.note,
                }
              : line,
          ),
        };
      }),
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-emerald-100 bg-[linear-gradient(180deg,#fcfffd_0%,#f3fbf6_100%)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Lista e purchase orders</h2>
            <p className="mt-1 text-sm text-slate-500">
              Kliko nje rresht per me pa cfare eshte porositur.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            + Shto purchase order
          </button>
        </div>

        <form
          method="get"
          className="grid gap-3 border-b border-emerald-100 bg-white px-5 py-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:px-6"
        >
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Kerkim
            <input
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="PO # ose furnitori"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Statusi
            <select
              name="status"
              defaultValue={statusFilter}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="ALL">Te gjitha</option>
              <option value="DRAFT">Draft</option>
              <option value="ORDERED">Ordered</option>
              <option value="PARTIALLY_RECEIVED">Partial</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-[50px] items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Filtroni
            </button>
            <a
              href="/purchases"
              className="inline-flex h-[50px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Reset
            </a>
          </div>
        </form>

        {purchaseOrders.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            Nuk u gjet asnje purchase order per filtrat aktuale.
          </div>
        ) : (
          <>
            <div className="grid gap-4 p-4 lg:hidden">
              {purchaseOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#fbfefc_100%)] p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">PO #{order.id}</h3>
                      <p className="mt-1 text-sm text-slate-500">{order.supplierName}</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(order.status)}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600">
                    <p>{order.warehouseName}</p>
                    <p>{order.orderedAtLabel}</p>
                    <p>{order.totalLabel}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-sm">
                <thead className="bg-[linear-gradient(180deg,#f6fdf8_0%,#eef8f1_100%)] text-left">
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                    <th className="px-5 py-4">PO</th>
                    <th className="px-5 py-4">Furnitori</th>
                    <th className="px-5 py-4">Depoja</th>
                    <th className="px-5 py-4">Statusi</th>
                    <th className="px-5 py-4">Artikuj</th>
                    <th className="px-5 py-4">Vlera</th>
                    <th className="px-5 py-4">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50 bg-white">
                  {purchaseOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="cursor-pointer align-top transition hover:bg-emerald-50/45"
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950">PO #{order.id}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{order.supplierName}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{order.warehouseName}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(order.status)}`}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {order.itemCount} variante / {order.totalQuantity} cope
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {order.totalLabel}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{order.orderedAtLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <dialog
        ref={createDialogRef}
        className="m-auto h-[min(94vh,980px)] w-[min(1240px,calc(100%-1.5rem))] rounded-[32px] border border-slate-200 bg-[#fbfdfc] p-0 text-left shadow-[0_30px_100px_rgba(15,23,42,0.22)] backdrop:bg-slate-950/45"
        onClose={() => setIsCreateOpen(false)}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200/80 bg-white px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  aria-label="Kthehu"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 fill-none stroke-current stroke-[1.8]"
                  >
                    <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div>
                  <h2 className="text-[30px] font-semibold tracking-tight text-slate-950">
                    Create Purchase Order
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add supplier, products and quantities
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  formMethod="post"
                  form="purchase-order-create-form"
                  name="submitIntent"
                  value="draft"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Save as Draft
                </button>
                <button
                  type="submit"
                  formMethod="post"
                  form="purchase-order-create-form"
                  name="submitIntent"
                  value="create"
                  disabled={draftGroups.length === 0}
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#10b981_0%,#059669_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(16,185,129,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create Purchase Order
                </button>
              </div>
            </div>
          </div>

          <form
            id="purchase-order-create-form"
            action={action}
            className="flex min-h-0 flex-1 flex-col"
          >
            <input type="hidden" name="items" value={itemsPayload} />
            <input type="hidden" name="status" value={status} />

            <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fbfdfc_0%,#f3f8f5_100%)] px-5 py-5 sm:px-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-6">
                  <section className={sectionCardClass()}>
                    <div className="mb-5 flex items-center gap-3">
                      <SectionTitleIcon>
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5 fill-none stroke-current stroke-[1.8]"
                        >
                          <path d="M7 4h7l5 5v11a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                          <path d="M14 4v5h5" />
                        </svg>
                      </SectionTitleIcon>
                      <div>
                        <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                          Order Details
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Supplier, depot and order info.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Supplier
                        <select
                          name="supplierId"
                          required
                          value={supplierId}
                          onChange={(event) => setSupplierId(event.target.value)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        >
                          <option value="">Select supplier</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Order Date
                        <input
                          type="date"
                          name="orderedAt"
                          value={orderedAt}
                          onChange={(event) => setOrderedAt(event.target.value)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        />
                      </label>

                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Status
                        <select
                          value={status}
                          onChange={(event) => setStatus(event.target.value)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        >
                          <option value="ORDERED">Ordered</option>
                          <option value="DRAFT">Draft</option>
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Warehouse
                        <select
                          name="warehouseId"
                          required
                          value={warehouseId}
                          onChange={(event) => setWarehouseId(event.target.value)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        >
                          <option value="">Select warehouse</option>
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
                      Reference / Note
                      <textarea
                        name="note"
                        rows={2}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        placeholder="Add note or reference (optional)"
                      />
                    </label>
                  </section>

                  <section className={sectionCardClass()}>
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <SectionTitleIcon>
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5 fill-none stroke-current stroke-[1.8]"
                          >
                            <path d="m7 7 5-3 5 3v10l-5 3-5-3z" />
                            <path d="m7 7 5 3 5-3" />
                          </svg>
                        </SectionTitleIcon>
                        <div>
                          <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                            Add Product
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Select a product and add variants to this order.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={resetActivePicker}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Category
                        <select
                          value={selectedCategory}
                          onChange={(event) => handleCategoryChange(event.target.value)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        >
                          <option value="">Select category</option>
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Brand
                        <select
                          value={selectedBrand}
                          onChange={(event) => handleBrandChange(event.target.value)}
                          disabled={!shouldShowBrand}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        >
                          <option value="">
                            {shouldShowBrand ? "Select brand" : "No brand filter"}
                          </option>
                          {brandOptions.map((brand) => (
                            <option key={brand} value={brand}>
                              {brand}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Model
                        <select
                          value={selectedProductId}
                          onChange={(event) => handleProductChange(event.target.value)}
                          disabled={productOptions.length === 0}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        >
                          <option value="">Select model</option>
                          {productOptions.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.brand ? `${product.brand} - ${product.name}` : product.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Color
                        <select
                          value={selectedColor}
                          onChange={(event) => handleColorChange(event.target.value)}
                          disabled={colorOptions.length === 0}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        >
                          <option value="">Select color</option>
                          {colorOptions.map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/55 p-4">
                      {selectedProduct ? (
                        <div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-base font-semibold text-slate-950">
                                {selectedProduct.brand
                                  ? `${selectedProduct.brand} ${selectedProduct.name}`
                                  : selectedProduct.name}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {selectedProduct.categoryName}
                                {selectedColor ? ` / ${selectedColor}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={addCurrentSelection}
                              disabled={selectionCount === 0}
                              className="inline-flex items-center justify-center rounded-2xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Add selected
                            </button>
                          </div>

                          {selectedColor ? (
                            <div className="mt-4 space-y-4">
                              <div
                                className={`${isFootwear ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "space-y-3"}`}
                              >
                              {activeVariants.map((variant) => {
                                const lineKey = buildDraftIdentityKey(
                                  selectedProduct.id,
                                  variant.size,
                                  variant.color,
                                );
                                const selected = Boolean(selectionMap[lineKey]);
                                const disabled = usedVariantKeys.has(lineKey);

                                return (
                                  <div
                                    key={variant.id}
                                    className={`rounded-2xl border p-3 transition ${
                                      selected
                                        ? "border-emerald-300 bg-emerald-50"
                                        : "border-slate-200 bg-white"
                                    } ${disabled ? "opacity-50" : ""}`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleVariantSelection(variant)}
                                      disabled={disabled}
                                      className={`w-full text-left ${disabled ? "cursor-not-allowed" : ""}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-semibold text-slate-950">
                                            {variant.size || "Standard"}
                                          </p>
                                          <p className="mt-1 text-xs text-slate-500">
                                            {variant.price.toFixed(2)} EUR
                                          </p>
                                        </div>
                                        <span
                                          className={`h-5 w-5 rounded-full border ${
                                            selected
                                              ? "border-emerald-500 bg-emerald-500"
                                              : "border-slate-300 bg-white"
                                          }`}
                                        />
                                      </div>
                                    </button>
                                  </div>
                                );
                              })}
                              </div>

                              {isFootwear && selectedProduct ? (
                                <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                    Shto numer qe nuk eshte ne sistem
                                  </p>
                                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                                    <input
                                      type="text"
                                      value={customSize}
                                      onChange={(event) => setCustomSize(event.target.value)}
                                      placeholder="p.sh. 45"
                                      className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                                    />
                                    <button
                                      type="button"
                                      onClick={addCustomSizeSelection}
                                      className="inline-flex items-center justify-center rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                                    >
                                      Shto numer
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {!isFootwear ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500">
                                  Sasinë dhe koston mund t'i rregullosh më poshtë te tabela e order items.
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-4 text-sm text-slate-500">
                              Zgjedh ngjyren per me pa variantet.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <div className="flex h-28 w-28 items-center justify-center rounded-[22px] border border-slate-200 bg-white text-slate-300">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-8 w-8 fill-none stroke-current stroke-[1.7]"
                            >
                              <path d="M7 7h10v10H7z" />
                              <path d="m9 13 2 2 4-4" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-slate-900">
                              No product selected
                            </p>
                            <p className="mt-2 text-sm text-slate-500">
                              Choose a product and variants to add to the order.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-6 xl:sticky xl:top-0 xl:self-start">
                  <section className={sectionCardClass()}>
                    <div className="mb-5 flex items-center gap-3">
                      <SectionTitleIcon accent="slate">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5 fill-none stroke-current stroke-[1.8]"
                        >
                          <path d="M12 3v18" />
                          <path d="M7 8h6a3 3 0 1 1 0 6H11a3 3 0 1 0 0 6h6" />
                        </svg>
                      </SectionTitleIcon>
                      <div>
                        <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                          Order Summary
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Totals update as you add lines.
                        </p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50/45">
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 text-sm">
                        <span className="text-slate-600">Total Variants</span>
                        <span className="font-semibold text-slate-950">
                          {draftSummary.lineCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 text-sm">
                        <span className="text-slate-600">Total Quantity</span>
                        <span className="font-semibold text-slate-950">
                          {draftSummary.totalQuantity}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-4 text-sm">
                        <span className="font-semibold text-slate-900">Subtotal</span>
                        <span className="text-xl font-semibold text-emerald-600">
                          {formatCurrency(draftSummary.subtotal)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-white/75 px-4 py-4">
                      {draftSummary.lineCount === 0 ? (
                        <div className="text-center">
                          <p className="text-sm font-medium text-slate-700">Asnje variant ende</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Zgjidh produktet ne anen e majte dhe ato shfaqen direkt te tabela poshte.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Rreshtat aktive</span>
                            <span className="font-semibold text-slate-950">
                              {draftSummary.lineCount}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Cope totale</span>
                            <span className="font-semibold text-slate-950">
                              {draftSummary.totalQuantity}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              <section className={`mt-6 ${sectionCardClass()}`}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                        Order Items
                      </h3>
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {draftSummary.lineCount} rreshta
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Review quantities and unit costs before saving.
                    </p>
                  </div>
                  {draftGroups.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDraftGroups([])}
                      className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                    >
                      Clear All
                    </button>
                  ) : null}
                </div>

                {draftGroups.length === 0 ? (
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/55 px-4 py-14 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-8 w-8 fill-none stroke-current stroke-[1.8]"
                      >
                        <path d="M7 4h10v14H7z" />
                        <path d="M9 9h6M9 13h6" />
                      </svg>
                    </div>
                    <p className="mt-5 text-lg font-semibold text-slate-900">
                      No items in this order
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Add products from the form above.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50/80 text-left">
                        <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Variant</th>
                          <th className="px-4 py-3">Quantity</th>
                          <th className="px-4 py-3">Unit Cost</th>
                          <th className="px-4 py-3">Total Cost</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {draftGroups.flatMap((group) =>
                          group.lines.map((line) => (
                            <tr key={`${group.id}-${line.key}`}>
                              <td className="px-4 py-4">
                                <div>
                                  <p className="font-semibold text-slate-950">
                                    {group.brand
                                      ? `${group.brand} ${group.productName}`
                                      : group.productName}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {group.categoryName}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>
                                    {line.color} / {line.size || "Standard"}
                                  </span>
                                  {line.isCustom ? (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                                      I ri
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <input
                                  type="number"
                                  min={1}
                                  value={line.quantity}
                                  onChange={(event) =>
                                    updateDraftLine(
                                      group.id,
                                      line.key,
                                      "quantity",
                                      event.target.value,
                                    )
                                  }
                                  className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-300"
                                />
                              </td>
                              <td className="px-4 py-4">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={line.unitCost}
                                  onChange={(event) =>
                                    updateDraftLine(
                                      group.id,
                                      line.key,
                                      "unitCost",
                                      event.target.value,
                                    )
                                  }
                                  className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-300"
                                />
                              </td>
                              <td className="px-4 py-4 font-semibold text-slate-950">
                                {formatCurrency(line.quantity * Number(line.unitCost || 0))}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeDraftLineByKey(group.id, line.key)}
                                  className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                                >
                                  Largo
                                </button>
                              </td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </form>
        </div>
      </dialog>

      <dialog
        ref={detailsDialogRef}
        className="m-auto w-[min(860px,calc(100%-1.5rem))] rounded-[30px] border border-emerald-100 bg-white p-0 text-left shadow-[0_28px_90px_rgba(15,23,42,0.24)] backdrop:bg-slate-950/45"
        onClose={closeDetailsModal}
      >
        {selectedOrder ? (
          <div className="max-h-[88vh] overflow-y-auto">
            <div className="border-b border-emerald-100 px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    PO #{selectedOrder.id}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {selectedOrder.supplierName}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedOrder.warehouseName} / {selectedOrder.orderedAtLabel}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/purchases/${selectedOrder.id}/export.pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                  >
                    Export PDF
                  </a>
                  <button
                    type="button"
                    onClick={closeDetailsModal}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Mbyll
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Statusi
                  </p>
                  <p className="mt-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(selectedOrder.status)}`}
                    >
                      {statusLabel(selectedOrder.status)}
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Artikuj
                  </p>
                  <p className="mt-2 font-semibold text-slate-950">
                    {selectedOrder.itemCount} variante / {selectedOrder.totalQuantity} cope
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Vlera
                  </p>
                  <p className="mt-2 font-semibold text-slate-950">
                    {selectedOrder.totalLabel}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Rreshtat e porosise</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Shfaq porosine origjinale, sasine e pranuar dhe pjesen e mbetur per secilin variant.
                  </p>
                </div>

                {selectedOrder.items.map((item) => (
                  <div
                    key={`summary-${item.id}`}
                    className="rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#fbfefc_100%)] px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-950">{item.productName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.color} / {item.size || "Standard"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                          Order: {item.orderedQuantity}
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                          Pranuar: {item.receivedQuantity}
                        </span>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-700">
                          Mbetur: {item.remainingQuantity}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                          {item.unitCostLabel}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                          {item.lineTotalLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedOrder.status === "ORDERED" || selectedOrder.status === "PARTIALLY_RECEIVED" ? (
                <form action={receiveAction} className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,#f8fffb_0%,#effaf3_100%)] p-4">
                  <input type="hidden" name="purchaseOrderId" value={selectedOrder.id} />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">Receive Stock</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Vendos sasine qe po hyn tani ne depo per secilin variant.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        name="receiveMode"
                        value="all"
                        className="inline-flex items-center justify-center rounded-2xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                      >
                        Receive all remaining
                      </button>
                      <button
                        type="submit"
                        name="receiveMode"
                        value="custom"
                        className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#10b981_0%,#059669_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(16,185,129,0.24)] transition hover:brightness-105"
                      >
                        Ruaj pranimin
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={`receive-${item.id}`}
                        className="grid gap-3 rounded-2xl border border-white/80 bg-white/90 p-4 sm:grid-cols-[minmax(0,1fr)_120px]"
                      >
                        <div>
                          <p className="font-semibold text-slate-950">{item.productName}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {item.color} / {item.size || "Standard"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
                              Ordered {item.orderedQuantity}
                            </span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                              Received {item.receivedQuantity}
                            </span>
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                              Remaining {item.remainingQuantity}
                            </span>
                          </div>
                        </div>

                        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Receive now
                          <input
                            type="number"
                            name={`received_${item.id}`}
                            min={0}
                            max={item.remainingQuantity}
                            defaultValue={item.remainingQuantity > 0 ? item.remainingQuantity : 0}
                            disabled={item.remainingQuantity <= 0}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-50"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </form>
              ) : null}

              {selectedOrder.note ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Shenime
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{selectedOrder.note}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
