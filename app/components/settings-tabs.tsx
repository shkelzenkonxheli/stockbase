"use client";

import { Children, type ReactNode, useMemo, useState } from "react";

type TabKey = "settings" | "categories" | "variables" | "view" | "warehouses";
type SectionKey = "profile" | "language" | "catalog" | TabKey;

type SettingsTabsProps = {
  settings: ReactNode;
  categories: ReactNode;
  variables: ReactNode;
  view: ReactNode;
  warehouses: ReactNode;
  footer?: ReactNode;
};

const NAV_GROUPS: Array<{ title: string; items: Array<{ key: SectionKey; label: string; icon: string }> }> = [
  { title: "Te pergjithshme", items: [
    { key: "profile", label: "Profili i biznesit", icon: "profile" },
    { key: "language", label: "Gjuha", icon: "language" },
  ] },
  { title: "Katalogu", items: [
    { key: "catalog", label: "Konfigurimi", icon: "catalog" },
    { key: "categories", label: "Kategorite", icon: "categories" },
    { key: "variables", label: "Variablat", icon: "variables" },
  ] },
  { title: "Inventari", items: [{ key: "warehouses", label: "Depot", icon: "warehouse" }] },
  { title: "Pamja", items: [{ key: "view", label: "Shfaqja e listave", icon: "view" }] },
];

const ICONS: Record<string, ReactNode> = {
  profile: <><path d="M4 20V7l8-4 8 4v13H4Z" /><path d="M9 20v-7h6v7M4 9h16" /></>,
  language: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  catalog: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
  categories: <><path d="m12 3 9 9-9 9-9-9 9-9Z" /><path d="M8 12h8" /></>,
  variables: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="white" /><circle cx="15" cy="12" r="2" fill="white" /><circle cx="10" cy="17" r="2" fill="white" /></>,
  warehouse: <><path d="M3 20V8l9-5 9 5v12H3Z" /><path d="M8 20v-7h8v7M3 10h18" /></>,
  view: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M9 21h6M12 18v3" /></>,
};

export function SettingsTabs({ settings, categories, variables, view, warehouses, footer }: SettingsTabsProps) {
  const [activeSection, setActiveSection] = useState<SectionKey>("profile");
  const activeTab: TabKey = activeSection === "profile" || activeSection === "language" || activeSection === "catalog" ? "settings" : activeSection;
  const panels = useMemo(() => ({
    settings: Children.toArray(settings),
    warehouses: Children.toArray(warehouses),
    categories: Children.toArray(categories),
    variables: Children.toArray(variables),
    view: Children.toArray(view),
  }), [categories, settings, variables, view, warehouses]);

  function openSection(key: SectionKey) {
    setActiveSection(key);
    if (key === "profile" || key === "language" || key === "catalog") {
      requestAnimationFrame(() => document.getElementById(`settings-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  return (
    <div className="grid min-w-0 lg:grid-cols-[218px_minmax(0,1fr)]">
      <aside className="min-w-0 border-b border-slate-200 bg-slate-50/75 p-3 lg:border-b-0 lg:border-r lg:p-4">
        <nav aria-label="Seksionet e konfigurimit" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-0">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="flex shrink-0 gap-1 lg:block">
              <p className="hidden px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 lg:block">{group.title}</p>
              <div className="flex gap-1 lg:block lg:space-y-1">
                {group.items.map((item) => (
                  <button key={item.key} type="button" onClick={() => openSection(item.key)} aria-current={activeSection === item.key ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border px-3 text-left text-sm font-medium transition lg:w-full ${activeSection === item.key ? "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm" : "border-transparent text-slate-600 hover:bg-white hover:text-slate-950"}`}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 fill-none stroke-current stroke-[1.7]">{ICONS[item.icon]}</svg>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <div className="px-4 py-6 sm:px-7 sm:py-7 lg:px-9">
          <div className={activeTab === "settings" ? "block" : "hidden"}>{panels.settings}</div>
          <div className={activeTab === "warehouses" ? "block" : "hidden"}>{panels.warehouses}</div>
          <div className={activeTab === "categories" ? "block" : "hidden"}>{panels.categories}</div>
          <div className={activeTab === "variables" ? "block" : "hidden"}>{panels.variables}</div>
          <div className={activeTab === "view" ? "block" : "hidden"}>{panels.view}</div>
        </div>
        {activeTab !== "warehouses" && footer ? <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-7 lg:px-9">{footer}</div> : null}
      </div>
    </div>
  );
}
