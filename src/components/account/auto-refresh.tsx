"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps account figures fresh without a full reload: refreshes server components when the tab regains
 * focus, and polls while a payment is still pending confirmation.
 */
export function AutoRefresh({ pending, intervalMs = 5000 }: { pending: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    const t = pending ? setInterval(() => router.refresh(), intervalMs) : undefined;
    return () => {
      window.removeEventListener("focus", onFocus);
      if (t) clearInterval(t);
    };
  }, [pending, intervalMs, router]);
  return null;
}
