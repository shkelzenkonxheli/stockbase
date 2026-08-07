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
          ? "flex gap-1.5"
          : "space-y-0.5"
      }
    >
      {items.map((item) => {
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            onClick={(event) => {
              const details = event.currentTarget.closest("details");
              if (details) {
                details.removeAttribute("open");
              }
            }}
            className={`group flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors ${
              isHorizontal ? "shrink-0 px-2.5 py-2" : "px-2.5 py-2"
            } ${
              isActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            <span
              className={`flex items-center justify-center rounded-md transition-colors ${
                isHorizontal ? "h-6 w-6" : "h-7 w-7"
              } ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground group-hover:bg-card group-hover:text-foreground"
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
