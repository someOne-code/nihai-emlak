"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function AosInit({ children }: Readonly<{ children?: ReactNode }>) {
  const pathname = usePathname();

  useEffect(() => {
    let disposed = false;
    let timeout = 0;

    function initializeAos() {
      timeout = window.setTimeout(async () => {
        try {
          const AOSModule = await import("aos");
          const AOS = AOSModule.default || AOSModule;

          if (disposed) {
            return;
          }

          AOS.init({
            duration: 800,
            once: false,
          });
          AOS.refreshHard();
        } catch (err) {
          console.error("AOS load error, running fallback:", err);
          document.querySelectorAll("[data-aos]").forEach((el) => {
            el.classList.add("aos-animate");
          });
        }
      }, 0);
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
      initializeAos();
    } else {
      window.addEventListener("load", initializeAos, { once: true });
    }

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      window.removeEventListener("load", initializeAos);
    };
  }, [pathname]);

  return children ?? null;
}
