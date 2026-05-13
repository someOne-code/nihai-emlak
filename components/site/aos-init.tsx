"use client";

import { useEffect, type ReactNode } from "react";

export function AosInit({ children }: Readonly<{ children?: ReactNode }>) {
  useEffect(() => {
    let disposed = false;
    let timeout = 0;

    function initializeAos() {
      timeout = window.setTimeout(async () => {
        const { default: AOS } = await import("aos");

        if (disposed) {
          return;
        }

        AOS.init({
          duration: 800,
          once: false,
        });
        AOS.refreshHard();
      }, 0);
    }

    if (document.readyState === "complete") {
      initializeAos();
    } else {
      window.addEventListener("load", initializeAos, { once: true });
    }

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      window.removeEventListener("load", initializeAos);
    };
  }, []);

  return children ?? null;
}
