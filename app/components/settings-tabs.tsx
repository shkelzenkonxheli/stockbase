"use client";

import { useState } from "react";

type TabKey = "categories" | "variables" | "view";

type SettingsTabsProps = {
  categories: React.ReactNode;
  variables: React.ReactNode;
  view: React.ReactNode;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "categories", label: "Kategorite" },
  { key: "variables", label: "Variablat" },
  { key: "view", label: "Pamja" },
];

export function SettingsTabs({ categories, variables, view }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("categories");

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
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

      <div className={activeTab === "categories" ? "block" : "hidden"}>{categories}</div>
      <div className={activeTab === "variables" ? "block" : "hidden"}>{variables}</div>
      <div className={activeTab === "view" ? "block" : "hidden"}>{view}</div>
    </div>
  );
}
