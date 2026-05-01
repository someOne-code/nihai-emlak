"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";

type AdminShellProps = {
  children: ReactNode;
};

export default function AdminShell({ children }: AdminShellProps) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(
    () => setSidebarOpen((value) => !value),
    [],
  );

  // Close the mobile drawer when the user presses Escape. Desktop is
  // unaffected because the sidebar is always rendered (lg:static).
  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [isSidebarOpen]);

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Menü arka planını kapat"
          onClick={closeSidebar}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      ) : null}

      <AdminSidebar
        isMobileOpen={isSidebarOpen}
        onNavigate={closeSidebar}
        onCloseMobile={closeSidebar}
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <AdminHeader
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
        />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
