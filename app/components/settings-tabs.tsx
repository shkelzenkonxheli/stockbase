"use client";

import { Children, type ReactNode, useMemo, useState } from "react";

type TabKey = "settings" | "categories" | "variables" | "view" | "warehouses";

type SettingsTabsProps = {
  settings: ReactNode;
  categories: ReactNode;
  variables: ReactNode;
  view: ReactNode;
  warehouses: ReactNode;
  footer?: ReactNode;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "settings", label: "Cilesimet" },
  { key: "warehouses", label: "Depot" },
  { key: "categories", label: "Kategorite" },
  { key: "variables", label: "Variablat" },
  { key: "view", label: "Pamja" },
];

export function SettingsTabs({ settings, categories, variables, view, warehouses, footer }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("settings");
  const panels = useMemo(
    () => ({
      settings: Children.toArray(settings),
      warehouses: Children.toArray(warehouses),
      categories: Children.toArray(categories),
      variables: Children.toArray(variables),
      view: Children.toArray(view),
      footer: footer ? Children.toArray(footer) : null,
    }),
    [categories, footer, settings, variables, view, warehouses],
  );

  return (
    <div className="space-y-5">
      <div className="mx-auto max-w-2xl overflow-x-auto">
        <div className="flex min-w-max gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-slate-950 text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)]"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={activeTab === "settings" ? "block" : "hidden"}>{panels.settings}</div>
      <div className={activeTab === "warehouses" ? "block" : "hidden"}>{panels.warehouses}</div>
      <div className={activeTab === "categories" ? "block" : "hidden"}>{panels.categories}</div>
      <div className={activeTab === "variables" ? "block" : "hidden"}>{panels.variables}</div>
      <div className={activeTab === "view" ? "block" : "hidden"}>{panels.view}</div>
      {activeTab !== "warehouses" ? panels.footer : null}
    </div>
  );
}
