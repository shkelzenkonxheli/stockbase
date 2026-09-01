"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  target?: "_blank";
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
          ? "flex gap-1.5"
          : "space-y-1"
      }
    >
      {items.map((item) => {
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            target={item.target}
            rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
            onClick={(event) => {
              const details = event.currentTarget.closest("details");
              if (details) {
                details.removeAttribute("open");
              }
            }}
            className={`flex items-center gap-2.5 rounded-2xl text-sm font-medium transition ${
              isHorizontal ? "shrink-0 px-2.5 py-2" : "px-2.5 py-2.5"
            } ${
              isActive
                ? "bg-emerald-50 text-emerald-950 shadow-sm ring-1 ring-emerald-200"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            <span
              className={`flex items-center justify-center rounded-xl ${
                isHorizontal ? "h-7 w-7" : "h-7.5 w-7.5"
              } ${
                isActive
                  ? "bg-emerald-600 text-white"
                  : isHorizontal
                    ? "bg-transparent text-slate-500"
                    : "bg-emerald-100/70 text-emerald-800"
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
