"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type AppShellNavProps = {
  items: NavItem[];
  orientation?: "vertical" | "horizontal";
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShellNav({
  items,
  orientation = "vertical",
}: AppShellNavProps) {
  const pathname = usePathname();
  const isHorizontal = orientation === "horizontal";

  return (
    <nav
      className={
        isHorizontal
          ? "flex gap-2"
          : "space-y-1.5"
      }
    >
      {items.map((item) => {
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-2xl text-sm font-medium transition ${
              isHorizontal ? "shrink-0 px-3 py-2" : "px-3 py-2.5"
            } ${
              isActive
                ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            <span
              className={`flex items-center justify-center rounded-xl ${
                isHorizontal ? "h-7 w-7" : "h-8 w-8"
              } ${
                isActive
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
