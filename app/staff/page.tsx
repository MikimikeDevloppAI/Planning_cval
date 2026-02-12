"use client";

import { StaffTable } from "@/components/staff/staff-table";

export default function StaffPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Inline header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/30 px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Personnel</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gérez les médecins, secrétaires et obstétriciennes
        </p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <StaffTable />
      </div>
    </div>
  );
}
