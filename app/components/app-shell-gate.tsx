"use client";

import { usePathname } from "next/navigation";

type AppShellGateProps = {
  enabled: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
};

export function AppShellGate({ enabled, header, children }: AppShellGateProps) {
  const pathname = usePathname();
  const hasOwnLayout = pathname.startsWith("/platform") || pathname === "/pos" || pathname.startsWith("/pos/") || pathname === "/workspace" || pathname.startsWith("/workspace/");

  if (!enabled || hasOwnLayout) return children;

  return (
    <div className="min-h-screen">
      {header}
      {children}
    </div>
  );
}
