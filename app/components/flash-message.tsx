"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FlashMessageProps = {
  type: "success" | "error";
  text: string;
  clearKeys?: string[];
  autoHideMs?: number;
  className?: string;
};

export function FlashMessage({
  type,
  text,
  clearKeys = ["success", "error"],
  autoHideMs = 3500,
  className = "",
}: FlashMessageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setVisible(false);

      const params = new URLSearchParams(searchParams.toString());

      for (const key of clearKeys) {
        params.delete(key);
      }

      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(nextUrl);
    }, autoHideMs);

    return () => clearTimeout(timeout);
  }, [autoHideMs, clearKeys, pathname, router, searchParams]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`${type === "error" ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"} ${className}`}
    >
      {text}
    </div>
  );
}
