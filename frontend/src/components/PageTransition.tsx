"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Re-mount the page subtree on route changes so the entrance animation runs. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
