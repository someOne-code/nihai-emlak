"use client";

import { useEffect, type ReactNode } from "react";
import AOS from "aos";

export function AosInit({ children }: Readonly<{ children?: ReactNode }>) {
  useEffect(() => {
    let timeout = 0;

    function initializeAos() {
      timeout = window.setTimeout(() => {
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
      window.clearTimeout(timeout);
      window.removeEventListener("load", initializeAos);
    };
  }, []);

  return children ?? null;
}
