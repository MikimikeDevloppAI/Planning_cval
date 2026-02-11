"use client";

import { StaffTable } from "@/components/staff/staff-table";

export default function StaffPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Personnel</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gérez les médecins, secrétaires et obstétriciennes
        </p>
      </div>
      <StaffTable />
    </div>
  );
}
