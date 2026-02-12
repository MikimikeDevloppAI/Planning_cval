"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-muted/30">
      <Sidebar />
      {/* Main content - offset for desktop sidebar (lg:pl-64) and mobile header (pt-16 on mobile) */}
      <div className="flex flex-1 flex-col overflow-hidden pt-16 lg:pt-0 lg:pl-64">
        <main className="flex-1 overflow-hidden bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
