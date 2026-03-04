"use client";

import { Building2 } from "lucide-react";
import { SitesView } from "@/components/sites/sites-view";

export default function SitesPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/30 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Sites & Départements
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gérez les sites et leurs départements
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <SitesView />
      </div>
    </div>
  );
}
