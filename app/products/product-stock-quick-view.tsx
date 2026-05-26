"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadedImage } from "@/app/components/uploaded-image";
import { LOW_STOCK_THRESHOLD, getStockTone } from "@/lib/inventory";

type ProductQuickVariant = {
  id: number;
  size: string;
  color: string;
  imagePath: string | null;
  stock: number;
  price?: number;
  material?: string | null;
  powerWatts?: string | null;
  locationCode?: string | null;
};

type ProductStockQuickViewProps = {
  productId: number;
  productName: string;
  productBrand: string;
  imagePath: string | null;
  variants: ProductQuickVariant[];
  className?: string;
  showImageButton?: boolean;
  iconOnly?: boolean;
  canAdjustStock?: boolean;
  canDeleteColor?: boolean;
};

type StockReason = "INCOMING_STOCK" | "CUSTOMER_RETURN";
type VariantDraftRow = {
  id: number;
  size: string;
  stock: string;
};

type StockViewMode = "footwear" | "electronics" | "home";

function getColorSwatchClass(color: string) {
  const normalized = color.trim().toLowerCase();

  if (normalized.includes("zez") || normalized.includes("black")) {
    return "bg-black";
  }
  if (normalized.includes("bardh") || normalized.includes("white")) {
    return "border border-slate-300 bg-white";
  }
  if (normalized.includes("kuq") || normalized.includes("red")) {
    return "bg-red-500";
  }
  if (normalized.includes("gjelb") || normalized.includes("green")) {
    return "bg-emerald-600";
  }
  if (normalized.includes("blu") || normalized.includes("blue")) {
    return "bg-blue-600";
  }
  if (normalized.includes("verdh") || normalized.includes("yellow")) {
    return "bg-yellow-400";
  }

  return "bg-slate-300";
}

function modalCardClass() {
  return "w-full rounded-[28px] bg-white p-5 shadow-2xl";
}

function IconPlus() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 4.167v11.666M4.167 10h11.666"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10 3.75 3.75 7.5 10 11.25 16.25 7.5 10 3.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5.833 10 10 12.5 14.167 10M5.833 13 10 15.5 14.167 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBox() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M4.375 6.25 10 3.75l5.625 2.5v7.5L10 16.25l-5.625-2.5v-7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.375 6.25 10 8.75m0 0 5.625-2.5M10 8.75v7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="m13.958 4.375 1.667 1.667M5.417 14.583l2.166-.416 7.5-7.5a1.179 1.179 0 0 0 0-1.667l-.833-.833a1.179 1.179 0 0 0-1.667 0l-7.5 7.5-.416 2.166Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="m5 10.417 3.125 3.125L15 6.667"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMore() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <circle cx="4.5" cy="10" r="1.4" />
      <circle cx="10" cy="10" r="1.4" />
      <circle cx="15.5" cy="10" r="1.4" />
    </svg>
  );
}

function normalizeCategoryName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getStockViewMode(categoryName: string): StockViewMode {
  const normalized = normalizeCategoryName(categoryName);

  if (["patika", "kepuce", "sandale"].includes(normalized)) {
    return "footwear";
  }

  if (normalized === "pajisje elektrike") {
    return "electronics";
  }

  return "home";
}

export function ProductStockQuickView({
  productId,
  productName,
  productBrand,
  imagePath,
  variants,
  className = "",
  showImageButton = true,
  iconOnly = false,
  canAdjustStock = false,
  canDeleteColor = false,
}: ProductStockQuickViewProps) {
  const router = useRouter();
  const stockViewMode = getStockViewMode(productBrand);
  const isElectricalCategory = stockViewMode === "electronics";
  const isFootwearCategory = stockViewMode === "footwear";
  const [showStock, setShowStock] = useState(false);
  const [variantsState, setVariantsState] = useState(variants);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [stockEditorColor, setStockEditorColor] = useState<string | null>(null);
  const [stockInputs, setStockInputs] = useState<Record<number, string>>({});
  const [stockReason, setStockReason] = useState<StockReason>("INCOMING_STOCK");
  const [stockError, setStockError] = useState<string | null>(null);
  const [savingStock, setSavingStock] = useState(false);

  const [editStockColor, setEditStockColor] = useState<string | null>(null);
  const [editStockInputs, setEditStockInputs] = useState<Record<number, string>>({});
  const [editStockLocation, setEditStockLocation] = useState("");
  const [editStockError, setEditStockError] = useState<string | null>(null);
  const [savingEditStock, setSavingEditStock] = useState(false);

  const [numberEditorColor, setNumberEditorColor] = useState<string | null>(null);
  const [newSize, setNewSize] = useState("");
  const [newStock, setNewStock] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingNumber, setCreatingNumber] = useState(false);

  const [showVariantCreator, setShowVariantCreator] = useState(false);
  const [variantColor, setVariantColor] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [variantMaterial, setVariantMaterial] = useState("");
  const [variantPowerWatts, setVariantPowerWatts] = useState("");
  const [variantLocation, setVariantLocation] = useState("");
  const [variantError, setVariantError] = useState<string | null>(null);
  const [creatingVariant, setCreatingVariant] = useState(false);
  const [variantImageFile, setVariantImageFile] = useState<File | null>(null);
  const [variantImagePreview, setVariantImagePreview] = useState<string | null>(null);
  const [variantRows, setVariantRows] = useState<VariantDraftRow[]>([]);
  const [variantDraftSize, setVariantDraftSize] = useState("");
  const [variantDraftStock, setVariantDraftStock] = useState("");
  const [openColorActions, setOpenColorActions] = useState<string | null>(null);
  const [variantActionsTarget, setVariantActionsTarget] = useState<ProductQuickVariant | null>(
    null,
  );
  const [stockEditorVariantId, setStockEditorVariantId] = useState<number | null>(null);
  const [editStockVariantId, setEditStockVariantId] = useState<number | null>(null);
  const [deleteVariantTarget, setDeleteVariantTarget] = useState<ProductQuickVariant | null>(
    null,
  );
  const [deleteColorTarget, setDeleteColorTarget] = useState<string | null>(null);
  const [deleteColorError, setDeleteColorError] = useState<string | null>(null);
  const [deletingColor, setDeletingColor] = useState(false);

  const groupedVariants = useMemo(() => {
    const sorted = [...variantsState].sort(
      (a, b) =>
        a.color.localeCompare(b.color, "sq", { sensitivity: "base" }) ||
        a.size.localeCompare(b.size, "sq", {
          numeric: true,
          sensitivity: "base",
        }),
    );

    return sorted.reduce(
      (groups, variant) => {
        const current = groups.get(variant.color) ?? [];
        current.push(variant);
        groups.set(variant.color, current);
        return groups;
      },
      new Map<string, ProductQuickVariant[]>(),
    );
  }, [variantsState]);

  const groupedByModel = useMemo(() => {
    if (!isElectricalCategory) {
      return [];
    }

    const groups = new Map<
      string,
      {
        model: string;
        totalStock: number;
        imagePath: string | null;
        variants: ProductQuickVariant[];
      }
    >();

    for (const variant of variantsState) {
      const modelKey = variant.size.trim() || "Pa model";
      const currentGroup = groups.get(modelKey);

      if (!currentGroup) {
        groups.set(modelKey, {
          model: modelKey,
          totalStock: variant.stock,
          imagePath: variant.imagePath,
          variants: [variant],
        });
        continue;
      }

      currentGroup.totalStock += variant.stock;
      currentGroup.imagePath = currentGroup.imagePath || variant.imagePath;
      currentGroup.variants.push(variant);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        variants: [...group.variants].sort((left, right) =>
          left.color.localeCompare(right.color, "sq", { sensitivity: "base" }),
        ),
      }))
      .sort((left, right) =>
        left.model.localeCompare(right.model, "sq", { sensitivity: "base" }),
      );
  }, [isElectricalCategory, variantsState]);

  const groupedBySpecification = useMemo(() => {
    if (stockViewMode !== "home") {
      return [];
    }

    const groups = new Map<
      string,
      {
        title: string;
        subtitle: string | null;
        totalStock: number;
        imagePath: string | null;
        variants: ProductQuickVariant[];
      }
    >();

    for (const variant of variantsState) {
      const dimension = variant.size.trim() || "Variant pa madhesi";
      const material = variant.material?.trim() || "";
      const groupKey = `${dimension}::${material}`;
      const currentGroup = groups.get(groupKey);

      if (!currentGroup) {
        groups.set(groupKey, {
          title: dimension,
          subtitle: material || null,
          totalStock: variant.stock,
          imagePath: variant.imagePath,
          variants: [variant],
        });
        continue;
      }

      currentGroup.totalStock += variant.stock;
      currentGroup.imagePath = currentGroup.imagePath || variant.imagePath;
      currentGroup.variants.push(variant);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        variants: [...group.variants].sort((left, right) =>
          left.color.localeCompare(right.color, "sq", { sensitivity: "base" }),
        ),
      }))
      .sort((left, right) =>
        left.title.localeCompare(right.title, "sq", {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [stockViewMode, variantsState]);

  const totalStock = variantsState.reduce((sum, variant) => sum + variant.stock, 0);
  const stockTone = getStockTone(totalStock);

  const colorEditorVariants = stockEditorColor
    ? groupedVariants.get(stockEditorColor) ?? []
    : [];
  const colorVariantsForEdit = editStockColor
    ? groupedVariants.get(editStockColor) ?? []
    : [];
  const colorVariantsForNewNumber = numberEditorColor
    ? groupedVariants.get(numberEditorColor) ?? []
    : [];
  const variantForStockAdd = stockEditorVariantId
    ? variantsState.find((variant) => variant.id === stockEditorVariantId) ?? null
    : null;
  const variantForStockEdit = editStockVariantId
    ? variantsState.find((variant) => variant.id === editStockVariantId) ?? null
    : null;
  const stockEditorVariants = variantForStockAdd ? [variantForStockAdd] : colorEditorVariants;
  const variantsForEditStock = variantForStockEdit ? [variantForStockEdit] : colorVariantsForEdit;
  const currentEditLocation = variantForStockEdit
    ? variantForStockEdit.locationCode ?? ""
    : colorVariantsForEdit[0]?.locationCode ?? "";

  const totalAddedForColor = stockEditorVariants.reduce((sum, variant) => {
    const parsed = Number(stockInputs[variant.id] ?? 0);
    return sum + (parsed > 0 ? parsed : 0);
  }, 0);

  const availableColors = useMemo(
    () => Array.from(groupedVariants.keys()).sort((a, b) => a.localeCompare(b, "sq")),
    [groupedVariants],
  );
  const normalizedVariantColor = variantColor.trim().toLowerCase();
  const existingVariantColor =
    availableColors.find(
      (color) => color.trim().toLowerCase() === normalizedVariantColor,
    ) ?? null;

  useEffect(() => {
    if (!successToast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccessToast(null);
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [successToast]);

  useEffect(() => {
    return () => {
      if (variantImagePreview) {
        URL.revokeObjectURL(variantImagePreview);
      }
    };
  }, [variantImagePreview]);

  function resetVariantCreator() {
    setShowVariantCreator(false);
    setVariantColor("");
    setVariantPrice("");
    setVariantMaterial("");
    setVariantPowerWatts("");
    setVariantLocation("");
    setVariantRows([]);
    setVariantDraftSize("");
    setVariantDraftStock("");
    setVariantError(null);
    setVariantImageFile(null);
    if (variantImagePreview) {
      URL.revokeObjectURL(variantImagePreview);
    }
    setVariantImagePreview(null);
  }

  function addVariantRow() {
    const size = variantDraftSize.trim();
    const stock = Number(variantDraftStock);

    if (!size || !Number.isInteger(stock) || stock < 0) {
      setVariantError("Ploteso numrin dhe sasine para se ta shtosh.");
      return;
    }

    const normalizedSize = size.toLowerCase();
    const alreadyAdded = variantRows.some(
      (row) => row.size.trim().toLowerCase() === normalizedSize,
    );
    const alreadyExists = variantsState.some(
      (variant) =>
        variant.color.trim().toLowerCase() === normalizedVariantColor &&
        variant.size.trim().toLowerCase() === normalizedSize,
    );

    if (alreadyAdded || alreadyExists) {
      setVariantError(`Numri ${size} ekziston tashme per kete ngjyre.`);
      return;
    }

    setVariantRows((current) => [
      ...current,
      {
        id: Date.now() + current.length,
        size,
        stock: String(stock),
      },
    ]);
    const parsedSize = Number(size);
    setVariantDraftSize(
      Number.isFinite(parsedSize) && size !== ""
        ? String(parsedSize + 1)
        : "",
    );
    setVariantDraftStock("");
    setVariantError(null);
  }

  async function saveQuickStock() {
    const updates = Object.entries(stockInputs)
      .map(([variantId, quantity]) => ({
        variantId: Number(variantId),
        quantity: Number(quantity),
      }))
      .filter(
        (item) =>
          Number.isInteger(item.variantId) &&
          item.variantId > 0 &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0,
      );

    if (updates.length === 0) {
      setStockError("Shkruaj te pakten nje sasi per ta ruajtur.");
      return;
    }

    setSavingStock(true);
    setStockError(null);

    try {
      const response = await fetch("/api/variants/quick-stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          reason: stockReason,
          updates,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setStockError(data?.error ?? "Ruajtja e stokut deshtoi.");
        return;
      }

      const updateMap = new Map(
        updates.map((item) => [item.variantId, item.quantity]),
      );

      setVariantsState((current) =>
        current.map((variant) => ({
          ...variant,
          stock: variant.stock + (updateMap.get(variant.id) ?? 0),
        })),
      );
      setStockInputs({});
      setStockEditorColor(null);
      setStockEditorVariantId(null);
      setSuccessToast("Stoku u perditesua.");
      router.refresh();
    } catch {
      setStockError("Ruajtja e stokut deshtoi.");
    } finally {
      setSavingStock(false);
    }
  }

  async function saveEditedStock() {
    const normalizedLocation = editStockLocation.trim() || null;
    const updates = variantsForEditStock
      .map((variant) => ({
        variantId: variant.id,
        currentStock: variant.stock,
        nextStock: Number(editStockInputs[variant.id]),
        currentLocation: variant.locationCode ?? null,
        nextLocation: normalizedLocation,
      }))
      .filter(
        (item) =>
          Number.isInteger(item.nextStock) &&
          item.nextStock >= 0 &&
          (item.nextStock !== item.currentStock || item.nextLocation !== item.currentLocation),
      );

    if (updates.length === 0) {
      setEditStockError("Ndrysho stokun ose lokacionin per ta ruajtur.");
      return;
    }

    setSavingEditStock(true);
    setEditStockError(null);

    try {
      const responses = await Promise.all(
        updates.map((item) =>
          fetch("/api/variants/quick-set-stock", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productId,
              variantId: item.variantId,
              stock: item.nextStock,
              locationCode: item.nextLocation,
            }),
          }),
        ),
      );

      const failed = responses.find((response) => !response.ok);

      if (failed) {
        const data = (await failed.json().catch(() => null)) as
          | { error?: string }
          | null;
        setEditStockError(data?.error ?? "Ndryshimi i stokut deshtoi.");
        return;
      }

      const updateMap = new Map(
        updates.map((item) => [item.variantId, item.nextStock]),
      );

      setVariantsState((current) =>
        current.map((variant) => ({
          ...variant,
          stock: updateMap.get(variant.id) ?? variant.stock,
          locationCode:
            updates.find((item) => item.variantId === variant.id)?.nextLocation ??
            variant.locationCode ??
            null,
        })),
      );
      setEditStockColor(null);
      setEditStockVariantId(null);
      setEditStockInputs({});
      setEditStockLocation("");
      setSuccessToast("Stoku u ndryshua.");
      router.refresh();
    } catch {
      setEditStockError("Ndryshimi i stokut deshtoi.");
    } finally {
      setSavingEditStock(false);
    }
  }

  async function saveNewNumber() {
    const size = newSize.trim();
    const stock = Number(newStock);

    if (!numberEditorColor || !size || !Number.isInteger(stock) || stock < 0) {
      setCreateError("Ploteso numrin dhe sasine.");
      return;
    }

    setCreatingNumber(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/variants/quick-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          color: numberEditorColor,
          size,
          stock,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; variant?: ProductQuickVariant }
        | null;

      if (!response.ok || !data?.variant) {
        setCreateError(data?.error ?? "Krijimi i numrit deshtoi.");
        return;
      }

      const createdVariant = data.variant;
      setVariantsState((current) => [...current, createdVariant]);
      setNumberEditorColor(null);
      setNewSize("");
      setNewStock("");
      setSuccessToast("Numri i ri u shtua.");
      router.refresh();
    } catch {
      setCreateError("Krijimi i numrit deshtoi.");
    } finally {
      setCreatingNumber(false);
    }
  }

  async function saveNewVariant() {
    const color = variantColor.trim();
    if (!color) {
      setVariantError("Ploteso ngjyren.");
      return;
    }

    if (existingVariantColor) {
      setVariantError("Kjo ngjyre ekziston tashme. Perdor Shto numer.");
      return;
    }

    const parsedPrice = Number(variantPrice);

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setVariantError("Jep cmimin per ngjyre te re.");
      return;
    }

    const pendingRows = [...variantRows];
    if (variantDraftSize.trim() || variantDraftStock.trim()) {
      pendingRows.push({
        id: Date.now() + pendingRows.length,
        size: variantDraftSize.trim(),
        stock: variantDraftStock.trim(),
      });
    }

    const cleanedRows = pendingRows
      .map((row) => ({
        size: row.size.trim(),
        stock: Number(row.stock),
      }))
      .filter((row) => row.size || row.stock || row.stock === 0);

    if (stockViewMode !== "footwear" && cleanedRows.length === 0) {
      const primaryValue = variantDraftSize.trim();
      const primaryStock = Number(variantDraftStock);

      if (!primaryValue || !Number.isInteger(primaryStock) || primaryStock < 0) {
        setVariantError("Ploteso fushen kryesore dhe sasine.");
        return;
      }

      cleanedRows.push({
        size: primaryValue,
        stock: primaryStock,
      });
    }

    if (cleanedRows.length === 0) {
      setVariantError("Shto te pakten nje numer.");
      return;
    }

    const invalidRow = cleanedRows.find(
      (row) => !row.size || !Number.isInteger(row.stock) || row.stock < 0,
    );

    if (invalidRow) {
      setVariantError("Ploteso numrin dhe sasine per cdo rresht.");
      return;
    }

    const seenSizes = new Set<string>();
    for (const row of cleanedRows) {
      const normalizedSize = row.size.toLowerCase();
      if (seenSizes.has(normalizedSize)) {
        setVariantError(`Numri ${row.size} eshte shkruar me shume se nje here.`);
        return;
      }
      seenSizes.add(normalizedSize);
    }

    setCreatingVariant(true);
    setVariantError(null);

    try {
      const createdVariants: ProductQuickVariant[] = [];

      for (const [index, row] of cleanedRows.entries()) {
        const formData = new FormData();
        formData.append("productId", String(productId));
        formData.append("color", color);
        formData.append("size", row.size);
        formData.append("stock", String(row.stock));
        formData.append("price", String(parsedPrice));
        if (variantMaterial.trim()) {
          formData.append("material", variantMaterial.trim());
        }
        if (variantPowerWatts.trim()) {
          formData.append("powerWatts", variantPowerWatts.trim());
        }
        if (variantLocation.trim()) {
          formData.append("locationCode", variantLocation.trim());
        }

        if (index === 0 && variantImageFile) {
          formData.append("image", variantImageFile);
        }

        const response = await fetch("/api/variants/quick-create", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json().catch(() => null)) as
          | { error?: string; variant?: ProductQuickVariant }
          | null;

        if (!response.ok || !data?.variant) {
          setVariantError(data?.error ?? "Krijimi i variantit deshtoi.");
          setCreatingVariant(false);
          return;
        }

        createdVariants.push(data.variant);
      }

      setVariantsState((current) => [...current, ...createdVariants]);
      resetVariantCreator();
      setSuccessToast("Variantet e reja u shtuan.");
      router.refresh();
    } catch {
      setVariantError("Krijimi i variantit deshtoi.");
    } finally {
      setCreatingVariant(false);
    }
  }

  async function deleteSingleVariant() {
    if (!deleteVariantTarget) {
      return;
    }

    setDeletingColor(true);
    setDeleteColorError(null);

    try {
      const response = await fetch("/api/variants/quick-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          variantId: deleteVariantTarget.id,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; deletedVariantId?: number }
        | null;

      if (!response.ok || !data?.deletedVariantId) {
        setDeleteColorError(data?.error ?? "Fshirja e variantit deshtoi.");
        return;
      }

      setVariantsState((current) =>
        current.filter((variant) => variant.id !== data.deletedVariantId),
      );
      setDeleteVariantTarget(null);
      setSuccessToast("Varianti u fshi.");
      router.refresh();
    } catch {
      setDeleteColorError("Fshirja e variantit deshtoi.");
    } finally {
      setDeletingColor(false);
    }
  }

  async function deleteColorGroup() {
    if (!deleteColorTarget) {
      return;
    }

    setDeletingColor(true);
    setDeleteColorError(null);

    try {
      const response = await fetch("/api/variants/delete-color", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          color: deleteColorTarget,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            deletedVariantIds?: number[];
          }
        | null;

      if (!response.ok || !data?.deletedVariantIds) {
        setDeleteColorError(data?.error ?? "Fshirja e ngjyres deshtoi.");
        return;
      }

      const deletedIds = new Set(data.deletedVariantIds);
      setVariantsState((current) =>
        current.filter((variant) => !deletedIds.has(variant.id)),
      );
      setDeleteColorTarget(null);
      setSuccessToast("Ngjyra u fshi.");
      router.refresh();
    } catch {
      setDeleteColorError("Fshirja e ngjyres deshtoi.");
    } finally {
      setDeletingColor(false);
    }
  }

  const quickVariantPrimaryLabel =
    stockViewMode === "electronics"
      ? "Modeli / versioni"
      : stockViewMode === "home"
        ? "Madhesia / dimensioni"
        : "Numri";
  const quickVariantModalDescription =
    stockViewMode === "electronics"
      ? "Krijo variant te ri me model/version, ngjyre, cmim dhe stok."
      : stockViewMode === "home"
        ? "Krijo variant te ri me madhesi/dimension, ngjyre, cmim dhe stok."
        : "Krijo ngjyre te re dhe shto disa numra ne nje hap.";
  const quickVariantExtraLabel =
    stockViewMode === "electronics"
      ? "Fuqia (opsionale)"
      : stockViewMode === "home"
        ? "Materiali (opsional)"
        : null;

  return (
    <>
      {showImageButton ? (
        <button
          type="button"
          onClick={() =>
            imagePath
              ? setPreviewImage({
                  src: imagePath,
                  alt: productName,
                })
              : undefined
          }
          className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${className} ${
            imagePath ? "transition hover:border-slate-300" : ""
          }`}
          title={imagePath ? "Hap foton" : "Pa foto"}
        >
          {imagePath ? (
            <UploadedImage
              src={imagePath}
              alt={productName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              IMG
            </div>
          )}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setShowStock(true)}
        className={`inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 ${
          iconOnly ? "h-10 w-10" : "px-3 py-2 text-sm font-medium"
        }`}
        aria-label="Stoku"
        title="Stoku"
      >
        {iconOnly ? <IconBox /> : "Stoku"}
      </button>

      {successToast ? (
        <div className="fixed inset-x-4 bottom-4 z-[120] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700 shadow-lg sm:left-auto sm:right-4 sm:w-auto sm:text-left">
          {successToast}
        </div>
      ) : null}

      {showStock ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
          onClick={() => setShowStock(false)}
        >
          <div
            className="flex max-h-[88vh] w-full flex-col rounded-t-[28px] bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-2xl sm:rounded-[28px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-5">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:h-16 sm:w-16">
                  {imagePath ? (
                    <UploadedImage
                      src={imagePath}
                      alt={productName}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-950 sm:text-xl">
                    {productName}
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-500">{productBrand}</p>
                  <span
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stockTone.badgeClassName}`}
                  >
                    {totalStock} cope - {stockTone.label}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {canAdjustStock ? (
                  <button
                    type="button"
                    onClick={() => {
      setShowVariantCreator(true);
      setVariantColor("");
      setVariantPrice("");
      setVariantRows([]);
      setVariantDraftSize("");
      setVariantDraftStock("");
      setVariantImageFile(null);
      if (variantImagePreview) {
        URL.revokeObjectURL(variantImagePreview);
                      }
                      setVariantImagePreview(null);
                      setVariantError(null);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:px-3 sm:text-sm"
                  >
                    <IconPlus />
                    Shto variant
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowStock(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Mbyll"
                >
                  x
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              {stockViewMode === "electronics" ? (
                groupedByModel.map((group) => {
                  const groupStockTone = getStockTone(group.totalStock);

                  return (
                    <section
                      key={group.model}
                      className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-slate-900">
                            {group.model}
                          </h3>
                        </div>

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${groupStockTone.badgeClassName}`}
                        >
                          {group.totalStock} cope
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {group.variants.map((variant) => {
                          const variantStockTone = getStockTone(variant.stock);

                          return (
                            <div
                              key={variant.id}
                              className="relative rounded-2xl border border-slate-200 bg-white px-3 py-3"
                            >
                              {(canAdjustStock || canDeleteColor) ? (
                                <div className="absolute right-3 top-3 z-10">
                                  <button
                                    type="button"
                                    onClick={() => setVariantActionsTarget(variant)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                                    aria-label={`Veprimet per ${variant.color}`}
                                  >
                                    <IconMore />
                                  </button>
                                </div>
                              ) : null}
                              <div className="flex items-start gap-3 pr-12">
                                <button
                                  type="button"
                                  onClick={() =>
                                    variant.imagePath
                                      ? setPreviewImage({
                                          src: variant.imagePath,
                                          alt: `${productName} ${group.model} ${variant.color}`,
                                        })
                                      : undefined
                                  }
                                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                                  title={variant.imagePath ? "Hap foton" : "Pa foto"}
                                >
                                  {variant.imagePath ? (
                                    <UploadedImage
                                      src={variant.imagePath}
                                      alt={`${productName} ${group.model} ${variant.color}`}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                      IMG
                                    </span>
                                  )}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${variantStockTone.badgeClassName}`}
                                  >
                                    {variant.stock} cope
                                  </span>
                                  <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                                    {variant.color}
                                  </p>
                                  {(variant.powerWatts || variant.material) ? (
                                    <p className="mt-1 truncate text-xs text-slate-500">
                                      {variant.powerWatts || variant.material}
                                    </p>
                                  ) : null}
                                  {variant.locationCode ? (
                                    <p className="mt-1 truncate text-xs text-slate-500">
                                      Lok: {variant.locationCode}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })
              ) : stockViewMode === "home" ? (
                groupedBySpecification.map((group) => {
                  const groupStockTone = getStockTone(group.totalStock);

                  return (
                    <section
                      key={`${group.title}-${group.subtitle ?? "base"}`}
                      className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-slate-900">
                            {group.title}
                          </h3>
                          {group.subtitle ? (
                            <p className="mt-1 text-sm text-slate-500">{group.subtitle}</p>
                          ) : null}
                        </div>

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${groupStockTone.badgeClassName}`}
                        >
                          {group.totalStock} cope
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {group.variants.map((variant) => {
                          const variantStockTone = getStockTone(variant.stock);

                          return (
                            <div
                              key={variant.id}
                              className="relative rounded-2xl border border-slate-200 bg-white px-3 py-3"
                            >
                              {(canAdjustStock || canDeleteColor) ? (
                                <div className="absolute right-3 top-3 z-10">
                                  <button
                                    type="button"
                                    onClick={() => setVariantActionsTarget(variant)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                                    aria-label={`Veprimet per ${variant.color}`}
                                  >
                                    <IconMore />
                                  </button>
                                </div>
                              ) : null}
                              <div className="flex items-start gap-3 pr-12">
                                <button
                                  type="button"
                                  onClick={() =>
                                    variant.imagePath
                                      ? setPreviewImage({
                                          src: variant.imagePath,
                                          alt: `${productName} ${group.title} ${variant.color}`,
                                        })
                                      : undefined
                                  }
                                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                                  title={variant.imagePath ? "Hap foton" : "Pa foto"}
                                >
                                  {variant.imagePath ? (
                                    <UploadedImage
                                      src={variant.imagePath}
                                      alt={`${productName} ${group.title} ${variant.color}`}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                      IMG
                                    </span>
                                  )}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-slate-900">
                                    {variant.color}
                                  </p>
                                  {(variant.material || variant.powerWatts) ? (
                                    <p className="mt-1 truncate text-xs text-slate-500">
                                      {variant.material || variant.powerWatts}
                                    </p>
                                  ) : null}
                                  {variant.locationCode ? (
                                    <p className="mt-1 truncate text-xs text-slate-500">
                                      Lok: {variant.locationCode}
                                    </p>
                                  ) : null}
                                  <span
                                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${variantStockTone.badgeClassName}`}
                                  >
                                    {variant.stock} cope
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })
              ) : (
              Array.from(groupedVariants.entries()).map(([color, colorVariants]) => {
                const colorImage =
                  colorVariants.find((variant) => variant.imagePath)?.imagePath ??
                  null;
                const colorStockTotal = colorVariants.reduce(
                  (sum, variant) => sum + variant.stock,
                  0,
                );

                return (
                  <section
                    key={color}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <button
                          type="button"
                          onClick={() =>
                            colorImage
                              ? setPreviewImage({
                                  src: colorImage,
                                  alt: `${productName} ${color}`,
                                })
                              : undefined
                          }
                          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white"
                          title={colorImage ? "Hap foton" : "Pa foto"}
                        >
                          {colorImage ? (
                            <UploadedImage
                              src={colorImage}
                              alt={`${productName} ${color}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              IMG
                            </span>
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex h-3 w-3 rounded-full ${getColorSwatchClass(color)}`}
                            />
                            <h3 className="text-base font-semibold text-slate-900">
                              {color}
                            </h3>
                          </div>
                          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                            {colorStockTotal} cope
                          </p>
                        </div>
                      </div>

                      {canAdjustStock && isFootwearCategory ? (
                        <div className="relative shrink-0 self-start">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenColorActions((current) =>
                                current === color ? null : color,
                              )
                            }
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                            aria-label={`Veprimet per ${color}`}
                          >
                            <IconMore />
                          </button>

                          {openColorActions === color ? (
                            <>
                              <div className="absolute right-0 top-12 z-20 hidden w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl sm:block">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenColorActions(null);
                                    setStockEditorColor(color);
                                    setStockInputs({});
                                    setStockReason("INCOMING_STOCK");
                                    setStockError(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  <IconBox />
                                  Shto sasi
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenColorActions(null);
                                    setNumberEditorColor(color);
                                    setNewSize("");
                                    setNewStock("");
                                    setCreateError(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  <IconLayers />
                                  Shto numer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenColorActions(null);
                                    setEditStockColor(color);
                                    setEditStockInputs(
                                      Object.fromEntries(
                                        colorVariants.map((variant) => [
                                          variant.id,
                                          String(variant.stock),
                                        ]),
                                      ),
                                    );
                                    setEditStockLocation(colorVariants[0]?.locationCode ?? "");
                                    setEditStockError(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  <IconPencil />
                                  Edito stokun
                                </button>
                                {canDeleteColor ? (
                                  <>
                                    <div className="my-1.5 h-px bg-slate-100" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenColorActions(null);
                                        setDeleteColorTarget(color);
                                        setDeleteColorError(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-rose-600 transition hover:bg-rose-50"
                                    >
                                      <span className="inline-flex h-4 w-4 items-center justify-center text-base leading-none">
                                        ×
                                      </span>
                                      Fshi ngjyren
                                    </button>
                                  </>
                                ) : null}
                              </div>

                              <div
                                className="fixed inset-0 z-20 bg-slate-950/15 sm:hidden"
                                onClick={() => setOpenColorActions(null)}
                              />
                              <div className="fixed inset-x-4 bottom-4 z-30 rounded-[24px] border border-slate-200 bg-white p-2 shadow-2xl sm:hidden">
                                <div className="mb-2 px-2 pt-1">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {color}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Zgjidh veprimin
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenColorActions(null);
                                    setStockEditorColor(color);
                                    setStockInputs({});
                                    setStockReason("INCOMING_STOCK");
                                    setStockError(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  <IconBox />
                                  Shto sasi
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenColorActions(null);
                                    setNumberEditorColor(color);
                                    setNewSize("");
                                    setNewStock("");
                                    setCreateError(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  <IconLayers />
                                  Shto numer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenColorActions(null);
                                    setEditStockColor(color);
                                    setEditStockInputs(
                                      Object.fromEntries(
                                        colorVariants.map((variant) => [
                                          variant.id,
                                          String(variant.stock),
                                        ]),
                                      ),
                                    );
                                    setEditStockLocation(colorVariants[0]?.locationCode ?? "");
                                    setEditStockError(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  <IconPencil />
                                  Edito stokun
                                </button>
                                {canDeleteColor ? (
                                  <>
                                    <div className="my-1.5 h-px bg-slate-100" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenColorActions(null);
                                        setDeleteColorTarget(color);
                                        setDeleteColorError(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                                    >
                                      <span className="inline-flex h-4 w-4 items-center justify-center text-base leading-none">
                                        ×
                                      </span>
                                      Fshi ngjyren
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
                      {colorVariants.map((variant) => {
                        const tone =
                          variant.stock > 0 && variant.stock <= LOW_STOCK_THRESHOLD
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : variant.stock > 0
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-100 text-slate-500";

                        return (
                          <div
                            key={`${color}-${variant.size}-${variant.id}`}
                            className={`min-w-0 rounded-2xl border px-3 py-2.5 sm:min-w-[92px] ${tone}`}
                          >
                            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em]">
                              Nr {variant.size}
                            </p>
                            <p className="mt-1 truncate text-xs font-medium">
                              {variant.stock} ne stok
                            </p>
                            {variant.locationCode ? (
                              <p className="mt-1 truncate text-[11px] font-medium opacity-80">
                                Lok: {variant.locationCode}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              }))}
            </div>
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[28px] bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/75 text-white transition hover:bg-slate-950"
              aria-label="Mbyll foton"
            >
              x
            </button>
            <div className="overflow-hidden rounded-[22px]">
              <UploadedImage
                src={previewImage.src}
                alt={previewImage.alt}
                className="h-auto max-h-[80vh] w-full object-contain bg-slate-50"
              />
            </div>
          </div>
        </div>
      ) : null}

      {variantActionsTarget ? (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/45 p-4"
          onClick={() => setVariantActionsTarget(null)}
        >
          <div
            className={`${modalCardClass()} max-w-sm`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Veprimet e variantit
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {variantActionsTarget.color}
                  {variantActionsTarget.size ? ` / ${variantActionsTarget.size}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVariantActionsTarget(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Mbyll"
              >
                x
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {canAdjustStock ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setStockEditorVariantId(variantActionsTarget.id);
                      setStockEditorColor(null);
                      setStockInputs({ [variantActionsTarget.id]: "" });
                      setStockReason("INCOMING_STOCK");
                      setStockError(null);
                      setVariantActionsTarget(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <IconBox />
                    Shto sasi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditStockVariantId(variantActionsTarget.id);
                      setEditStockColor(null);
                      setEditStockInputs({
                        [variantActionsTarget.id]: String(variantActionsTarget.stock),
                      });
                      setEditStockLocation(variantActionsTarget.locationCode ?? "");
                      setEditStockError(null);
                      setVariantActionsTarget(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <IconPencil />
                    Edito stokun
                  </button>
                </>
              ) : null}
              {canDeleteColor ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteVariantTarget(variantActionsTarget);
                    setDeleteColorError(null);
                    setVariantActionsTarget(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center text-base leading-none">
                    x
                  </span>
                  Fshi variantin
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {deleteColorTarget || deleteVariantTarget ? (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/65 p-4"
          onClick={() => {
            if (!deletingColor) {
              setDeleteColorTarget(null);
              setDeleteVariantTarget(null);
              setDeleteColorError(null);
            }
          }}
        >
          <div
            className={`${modalCardClass()} max-w-md`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  {deleteVariantTarget ? "Fshi variantin" : "Fshi ngjyren"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {deleteVariantTarget ? (
                    <>
                      Kjo do fshije variantin{" "}
                      <span className="font-semibold text-slate-900">
                        {deleteVariantTarget.color}
                        {deleteVariantTarget.size ? ` / ${deleteVariantTarget.size}` : ""}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      Kjo do fshije ngjyren{" "}
                      <span className="font-semibold text-slate-900">{deleteColorTarget}</span> dhe te gjithe numrat e saj.
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!deletingColor) {
                    setDeleteColorTarget(null);
                    setDeleteVariantTarget(null);
                    setDeleteColorError(null);
                  }
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Mbyll"
              >
                x
              </button>
            </div>

            {deleteColorError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {deleteColorError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!deletingColor) {
                    setDeleteColorTarget(null);
                    setDeleteColorError(null);
                  }
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={deletingColor}
              >
                Anulo
              </button>
              <button
                type="button"
                onClick={() => void (deleteVariantTarget ? deleteSingleVariant() : deleteColorGroup())}
                className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={deletingColor}
              >
                {deletingColor ? "Duke fshire..." : deleteVariantTarget ? "Fshi variantin" : "Fshi ngjyren"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stockEditorColor || stockEditorVariantId ? (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/65 p-3 sm:p-4"
          onClick={() => {
            if (!savingStock) {
              setStockEditorColor(null);
              setStockEditorVariantId(null);
              setStockError(null);
            }
          }}
        >
          <div
            className={`${modalCardClass()} max-h-[calc(100vh-24px)] max-w-xl overflow-hidden p-0 sm:max-h-[calc(100vh-32px)]`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex max-h-[calc(100vh-24px)] flex-col sm:max-h-[calc(100vh-32px)]">
            <div className="flex items-start justify-between gap-4 px-5 pb-0 pt-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Shto sasi - {variantForStockAdd ? `${variantForStockAdd.color}${variantForStockAdd.size ? ` / ${variantForStockAdd.size}` : ""}` : stockEditorColor}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {variantForStockAdd
                    ? "Zgjidh arsyen dhe vendos sa cope po shtohen per kete variant."
                    : "Zgjidh arsyen dhe vendos sa pale po shtohen per secilin numer."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!savingStock) {
                    setStockEditorColor(null);
                    setStockError(null);
                  }
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Mbyll"
              >
                x
              </button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto px-5 pb-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-3 grid gap-3 rounded-2xl bg-white px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Ngjyra
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span
                      className={`inline-flex h-3 w-3 rounded-full ${getColorSwatchClass(
                        variantForStockAdd ? variantForStockAdd.color : (stockEditorColor ?? ""),
                      )}`}
                    />
                    {variantForStockAdd ? variantForStockAdd.color : stockEditorColor}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Po shtohen
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">
                    +{totalAddedForColor}
                  </p>
                </div>
              </div>

              <label className="mb-3 block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Arsyeja
                </span>
                <select
                  value={stockReason}
                  onChange={(event) => setStockReason(event.target.value as StockReason)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                >
                  <option value="INCOMING_STOCK">Hyrje stoku</option>
                  <option value="CUSTOMER_RETURN">Kthim klienti</option>
                </select>
              </label>

              <div className="space-y-3">
                {stockEditorVariants.map((variant) => (
                  <div
                    key={`edit-${variant.id}-${variant.size}`}
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {variantForStockAdd ? variant.size || variant.color : `Nr ${variant.size}`}
                        </p>
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {variant.stock} ne stok
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <span className="text-sm font-semibold text-slate-400">+</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={stockInputs[variant.id] ?? ""}
                        onChange={(event) =>
                          setStockInputs((current) => ({
                            ...current,
                            [variant.id]: event.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100 sm:w-24"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>

            {stockError ? (
              <div className="mx-5 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {stockError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 pb-5 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!savingStock) {
                    setStockEditorColor(null);
                    setStockEditorVariantId(null);
                    setStockError(null);
                  }
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={savingStock}
              >
                Anulo
              </button>
              <button
                type="button"
                onClick={() => void saveQuickStock()}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={savingStock}
              >
                {!savingStock ? <IconCheck /> : null}
                {savingStock ? "Duke ruajtur..." : "Ruaj"}
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}

      {editStockColor || editStockVariantId ? (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/65 p-3 sm:p-4"
          onClick={() => {
            if (!savingEditStock) {
              setEditStockColor(null);
              setEditStockVariantId(null);
              setEditStockLocation("");
              setEditStockError(null);
            }
          }}
        >
          <div
            className={`${modalCardClass()} max-h-[calc(100vh-24px)] max-w-xl overflow-hidden p-0 sm:max-h-[calc(100vh-32px)]`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex max-h-[calc(100vh-24px)] flex-col sm:max-h-[calc(100vh-32px)]">
            <div className="flex items-start justify-between gap-4 px-5 pb-0 pt-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Edito stokun - {variantForStockEdit ? `${variantForStockEdit.color}${variantForStockEdit.size ? ` / ${variantForStockEdit.size}` : ""}` : editStockColor}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {variantForStockEdit
                    ? "Vendos stokun final per kete variant."
                    : "Vendos stokun final per secilin numer te kesaj ngjyre."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!savingEditStock) {
                    setEditStockColor(null);
                    setEditStockVariantId(null);
                    setEditStockError(null);
                    setEditStockLocation("");
                  }
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Mbyll"
              >
                x
              </button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto px-5 pb-4">
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
              <label className="block space-y-2">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Lokacioni
                </span>
                <input
                  type="text"
                  value={editStockLocation}
                  onChange={(event) => setEditStockLocation(event.target.value)}
                  placeholder={isFootwearCategory ? "p.sh. Sektori 1-10 / 7" : "p.sh. Sektori 11-20 / 4"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                />
              </label>
              <p className="mt-2 text-xs text-slate-500">
                {isFootwearCategory
                  ? "Ky lokacion do te ruhet per gjithe ngjyren."
                  : "Lokacion opsional per kete variant."}
              </p>
              {!editStockLocation && currentEditLocation ? (
                <p className="mt-1 text-xs text-slate-400">
                  Lokacioni aktual: {currentEditLocation}
                </p>
              ) : null}
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3">
              <div className="space-y-3">
                {variantsForEditStock.map((variant) => (
                  <div
                    key={`set-${variant.id}`}
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {variantForStockEdit ? variant.size || variant.color : `Nr ${variant.size}`}
                        </p>
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          aktual: {variant.stock}
                        </span>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={editStockInputs[variant.id] ?? ""}
                      onChange={(event) =>
                        setEditStockInputs((current) => ({
                          ...current,
                          [variant.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100 sm:w-24"
                    />
                  </div>
                ))}
              </div>
            </div>
            </div>

            {editStockError ? (
              <div className="mx-5 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {editStockError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 pb-5 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!savingEditStock) {
                    setEditStockColor(null);
                    setEditStockVariantId(null);
                    setEditStockLocation("");
                    setEditStockError(null);
                  }
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={savingEditStock}
              >
                Anulo
              </button>
              <button
                type="button"
                onClick={() => void saveEditedStock()}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={savingEditStock}
              >
                {!savingEditStock ? <IconCheck /> : null}
                {savingEditStock ? "Duke ruajtur..." : "Ruaj stokun"}
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}

      {numberEditorColor ? (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/65 p-3 sm:p-4"
          onClick={() => {
            if (!creatingNumber) {
              setNumberEditorColor(null);
              setCreateError(null);
            }
          }}
        >
          <div
            className={`${modalCardClass()} max-h-[calc(100vh-24px)] max-w-xl overflow-hidden p-0 sm:max-h-[calc(100vh-32px)]`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex max-h-[calc(100vh-24px)] flex-col sm:max-h-[calc(100vh-32px)]">
            <div className="flex items-start justify-between gap-4 px-5 pb-0 pt-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Shto numer - {numberEditorColor}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Krijo numer te ri brenda kesaj ngjyre. Cmimi merret automatikisht.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!creatingNumber) {
                    setNumberEditorColor(null);
                    setCreateError(null);
                  }
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Mbyll"
              >
                x
              </button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto px-5 pb-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Ngjyra
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span
                      className={`inline-flex h-3 w-3 rounded-full ${getColorSwatchClass(
                        numberEditorColor,
                      )}`}
                    />
                    {numberEditorColor}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Variante ekzistuese
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {colorVariantsForNewNumber.length}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Numri
                  </span>
                  <input
                    type="text"
                    value={newSize}
                    onChange={(event) => setNewSize(event.target.value)}
                    placeholder="44"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Sasia
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={newStock}
                    onChange={(event) => setNewStock(event.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                  />
                </label>
              </div>

              {colorVariantsForNewNumber.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Numrat ekzistues
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {colorVariantsForNewNumber.map((variant) => (
                      <span
                        key={`existing-${variant.id}`}
                        className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                      >
                        Nr {variant.size}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            </div>

            {createError ? (
              <div className="mx-5 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {createError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 pb-5 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!creatingNumber) {
                    setNumberEditorColor(null);
                    setCreateError(null);
                  }
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={creatingNumber}
              >
                Anulo
              </button>
              <button
                type="button"
                onClick={() => void saveNewNumber()}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={creatingNumber}
              >
                {!creatingNumber ? <IconCheck /> : null}
                {creatingNumber ? "Duke ruajtur..." : "Ruaj numerin"}
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}

      {showVariantCreator ? (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/65 p-3 sm:p-4"
          onClick={() => {
            if (!creatingVariant) {
              resetVariantCreator();
            }
          }}
        >
          <div
            className={`${modalCardClass()} max-h-[calc(100vh-24px)] max-w-3xl overflow-hidden p-0 sm:max-h-[calc(100vh-32px)]`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex max-h-[calc(100vh-24px)] flex-col sm:max-h-[calc(100vh-32px)]">
            <div className="flex items-start justify-between gap-4 px-5 pb-0 pt-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Shto variant
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {quickVariantModalDescription}
                </p>
                {stockViewMode === "footwear" && availableColors.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availableColors.map((color) => (
                      <span
                        key={`variant-color-${color}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600"
                      >
                        <span
                          className={`inline-flex h-2.5 w-2.5 rounded-full ${getColorSwatchClass(
                            color,
                          )}`}
                        />
                        {color}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!creatingVariant) {
                    resetVariantCreator();
                  }
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Mbyll"
              >
                x
              </button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto px-5 pb-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <div className={`grid items-start gap-4 ${stockViewMode === "footwear" ? "lg:grid-cols-[132px_minmax(0,1fr)]" : "lg:grid-cols-[148px_minmax(0,1fr)]"}`}>
                <div className="self-start rounded-2xl border border-slate-200 bg-white p-3">
                  <button
                    type="button"
                    onClick={() =>
                      variantImagePreview
                        ? setPreviewImage({
                            src: variantImagePreview,
                            alt: `${productName} ${variantColor || "variant"}`,
                          })
                        : undefined
                    }
                    className="flex h-[92px] w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    title={variantImagePreview ? "Hap foton" : "Pa foto"}
                  >
                    {variantImagePreview ? (
                      <UploadedImage
                        src={variantImagePreview}
                        alt={`${productName} ${variantColor || "variant"}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        IMG
                      </span>
                    )}
                  </button>
                  <input
                    id="quick-variant-image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;

                      if (variantImagePreview) {
                        URL.revokeObjectURL(variantImagePreview);
                      }

                      if (!file) {
                        setVariantImageFile(null);
                        setVariantImagePreview(null);
                        return;
                      }

                      setVariantImageFile(file);
                      setVariantImagePreview(URL.createObjectURL(file));
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="quick-variant-image"
                    className="mt-2 inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-950 px-2.5 py-2 text-[11px] font-medium text-white transition hover:bg-slate-800"
                  >
                    Zgjidh foton
                  </label>
                </div>

                <div className="min-w-0 space-y-4">
                  <div className={`grid gap-4 ${stockViewMode === "footwear" ? "sm:grid-cols-2" : "md:grid-cols-2"}`}>
                    <label className="min-w-0 space-y-2">
                      <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Ngjyra e re
                      </span>
                      <input
                        type="text"
                        value={variantColor}
                        onChange={(event) => setVariantColor(event.target.value)}
                        placeholder="Blue"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                      />
                    </label>

                    <label className="min-w-0 space-y-2">
                      <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Cmimi
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={variantPrice}
                        onChange={(event) => setVariantPrice(event.target.value)}
                        placeholder="0"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                      />
                    </label>
                  </div>

                  <label className="min-w-0 space-y-2">
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Lokacioni (opsional)
                    </span>
                    <input
                      type="text"
                      value={variantLocation}
                      onChange={(event) => setVariantLocation(event.target.value)}
                      placeholder={stockViewMode === "footwear" ? "p.sh. Sektori 1-10 / 7" : "p.sh. Sektori 11-20 / 4"}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                    />
                  </label>

                  {stockViewMode === "footwear" && existingVariantColor ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Kjo ngjyre ekziston tashme. Perdor `Shto numer`.
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    {stockViewMode === "footwear" ? (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Numrat
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Shto disa numra per te njejten ngjyre
                          </p>
                        </div>

                        <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-[minmax(0,1fr)_120px_auto]">
                          <label className="min-w-0 space-y-2">
                            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Numri
                            </span>
                            <input
                              type="text"
                              value={variantDraftSize}
                              onChange={(event) => setVariantDraftSize(event.target.value)}
                              placeholder="44"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                            />
                          </label>
                          <label className="min-w-0 space-y-2">
                            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Sasia
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={variantDraftStock}
                              onChange={(event) => setVariantDraftStock(event.target.value)}
                              placeholder="0"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={addVariantRow}
                            className="inline-flex h-[46px] w-full items-center justify-center gap-1 self-end rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 md:w-auto"
                          >
                            <IconPlus />
                            Shto
                          </button>
                        </div>

                        {variantRows.length > 0 ? (
                          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Numrat qe po shtohen
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {variantRows.map((row) => (
                                <div
                                  key={row.id}
                                  className="inline-flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2"
                                >
                                  <span className="text-sm font-semibold text-slate-900">
                                    Nr {row.size}
                                  </span>
                                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    {row.stock} cope
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVariantRows((current) =>
                                        current.filter((item) => item.id !== row.id),
                                      )
                                    }
                                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50"
                                  >
                                    Hiq
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="min-w-0 space-y-2">
                            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {quickVariantPrimaryLabel}
                            </span>
                            <input
                              type="text"
                              value={variantDraftSize}
                              onChange={(event) => setVariantDraftSize(event.target.value)}
                              placeholder={stockViewMode === "electronics" ? "p.sh. Wet & Dry 3L" : "p.sh. 140x70"}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                            />
                          </label>
                          <label className="min-w-0 space-y-2">
                            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Sasia
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={variantDraftStock}
                              onChange={(event) => setVariantDraftStock(event.target.value)}
                              placeholder="0"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                            />
                          </label>
                        </div>
                        {quickVariantExtraLabel ? (
                          <label className="min-w-0 space-y-2">
                            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {quickVariantExtraLabel}
                            </span>
                            <input
                              type="text"
                              value={stockViewMode === "electronics" ? variantPowerWatts : variantMaterial}
                              onChange={(event) =>
                                stockViewMode === "electronics"
                                  ? setVariantPowerWatts(event.target.value)
                                  : setVariantMaterial(event.target.value)
                              }
                              placeholder={stockViewMode === "electronics" ? "p.sh. 1800W" : "p.sh. Pambuk 100%"}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                            />
                          </label>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>

            {variantError ? (
              <div className="mx-5 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {variantError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 pb-5 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!creatingVariant) {
                    resetVariantCreator();
                  }
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={creatingVariant}
              >
                Anulo
              </button>
              <button
                type="button"
                onClick={() => void saveNewVariant()}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={creatingVariant}
              >
                {!creatingVariant ? <IconCheck /> : null}
                {creatingVariant ? "Duke ruajtur..." : "Ruaj variantin"}
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
