"use client";

import { useMemo, useState } from "react";
import type {
  OrderListFieldKey,
  OrderListViewConfig,
  ProductListFieldKey,
  ProductListViewConfig,
} from "@/lib/product-taxonomy";

type ListItem<T extends string> = {
  key: T;
  label: string;
};

type SettingsListViewEditorProps = {
  productDefaults: ProductListViewConfig;
  orderDefaults: OrderListViewConfig;
};

const PRODUCT_ITEMS: ListItem<ProductListFieldKey>[] = [
  { key: "brand", label: "Brandi" },
  { key: "category", label: "Kategoria" },
  { key: "stock", label: "Stoku" },
  { key: "price", label: "Cmimi" },
  { key: "sizes", label: "Madhesia / Numri" },
  { key: "colors", label: "Ngjyrat" },
  { key: "materials", label: "Materialet" },
  { key: "power", label: "Fuqia" },
];

const ORDER_ITEMS: ListItem<OrderListFieldKey>[] = [
  { key: "productImage", label: "Foto e produktit" },
  { key: "variantSummary", label: "Ngjyra / numri" },
  { key: "customerName", label: "Emri i klientit" },
  { key: "phone", label: "Telefoni" },
  { key: "quantity", label: "Sasia" },
  { key: "source", label: "Burimi" },
  { key: "status", label: "Statusi" },
  { key: "date", label: "Data" },
];

function moveItem<T>(array: T[], fromIndex: number, toIndex: number) {
  const next = [...array];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function DraggableList<T extends string>(props: {
  title: string;
  hint: string;
  items: ListItem<T>[];
  value: { order: T[]; visibility: Record<T, boolean> };
  onChange: (value: { order: T[]; visibility: Record<T, boolean> }) => void;
}) {
  const [draggedKey, setDraggedKey] = useState<T | null>(null);

  const orderedItems = useMemo(() => {
    return props.value.order
      .map((key) => props.items.find((item) => item.key === key))
      .filter(Boolean) as ListItem<T>[];
  }, [props.items, props.value.order]);

  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {props.title}
        </p>
        <p className="mt-1 text-sm text-slate-600">{props.hint}</p>
      </div>

      <div className="mt-4 space-y-3">
        {orderedItems.map((item, index) => (
          <div
            key={item.key}
            draggable
            onDragStart={() => setDraggedKey(item.key)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (!draggedKey || draggedKey === item.key) {
                return;
              }

              const fromIndex = props.value.order.indexOf(draggedKey);
              const toIndex = props.value.order.indexOf(item.key);
              if (fromIndex < 0 || toIndex < 0) {
                return;
              }

              props.onChange({
                ...props.value,
                order: moveItem(props.value.order, fromIndex, toIndex),
              });
              setDraggedKey(null);
            }}
            onDragEnd={() => setDraggedKey(null)}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="cursor-grab text-slate-400">::</span>
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500">Pozita {index + 1}</p>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={props.value.visibility[item.key]}
                onChange={(event) =>
                  props.onChange({
                    ...props.value,
                    visibility: {
                      ...props.value.visibility,
                      [item.key]: event.target.checked,
                    },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
              />
              Shfaq
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SettingsListViewEditor({
  productDefaults,
  orderDefaults,
}: SettingsListViewEditorProps) {
  const [productListView, setProductListView] = useState(productDefaults);
  const [orderListView, setOrderListView] = useState(orderDefaults);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <DraggableList
        title="Lista e produkteve"
        hint="Terhiqe per renditje. Checkbox vendos nese elementi shfaqet ne karte."
        items={PRODUCT_ITEMS}
        value={{ order: productListView.order, visibility: productListView.visibility }}
        onChange={(value) =>
          setProductListView((current) => ({
            ...current,
            order: value.order,
            visibility: value.visibility,
          }))
        }
      />

      <DraggableList
        title="Lista e porosive"
        hint="Terhiqe per renditje. Checkbox vendos nese elementi shfaqet ne liste."
        items={ORDER_ITEMS}
        value={{ order: orderListView.order, visibility: orderListView.visibility }}
        onChange={(value) =>
          setOrderListView((current) => ({
            ...current,
            order: value.order,
            visibility: value.visibility,
          }))
        }
      />

      <textarea
        name="productListViewConfig"
        value={JSON.stringify(productListView)}
        readOnly
        className="hidden"
      />
      <textarea
        name="orderListViewConfig"
        value={JSON.stringify(orderListView)}
        readOnly
        className="hidden"
      />
    </div>
  );
}
