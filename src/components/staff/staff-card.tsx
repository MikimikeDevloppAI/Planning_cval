"use client";

import { getInitials } from "@/lib/utils/initials";
import { POSITION_LABELS } from "@/lib/constants";
import { useUpdateStaff } from "@/hooks/use-staff";
import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface StaffCardProps {
  staff: {
    id_staff: number;
    firstname: string;
    lastname: string;
    id_primary_position: number;
    is_active: boolean;
    positions?: { name: string } | null;
  };
}

export function StaffCard({ staff }: StaffCardProps) {
  const updateStaff = useUpdateStaff();
  const [editing, setEditing] = useState(false);
  const [firstname, setFirstname] = useState(staff.firstname);
  const [lastname, setLastname] = useState(staff.lastname);

  const posColor =
    staff.id_primary_position === 1
      ? "bg-blue-500"
      : staff.id_primary_position === 2
      ? "bg-green-500"
      : "bg-purple-500";

  const handleSave = () => {
    updateStaff.mutate(
      { id: staff.id_staff, data: { firstname, lastname } },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-4">
        <Link
          href="/staff"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div
          className={`w-14 h-14 rounded-full ${posColor} flex items-center justify-center text-white text-lg font-bold shrink-0`}
        >
          {getInitials(staff.firstname, staff.lastname)}
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                className="text-lg font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-40"
                placeholder="Prénom"
              />
              <input
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                className="text-lg font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-40"
                placeholder="Nom"
              />
              <button
                onClick={handleSave}
                disabled={updateStaff.isPending}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setFirstname(staff.firstname);
                  setLastname(staff.lastname);
                  setEditing(false);
                }}
                className="p-1 text-gray-400 hover:bg-gray-50 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <h2
              className="text-xl font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => setEditing(true)}
              title="Cliquer pour modifier"
            >
              {staff.firstname} {staff.lastname}
            </h2>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                staff.id_primary_position === 1
                  ? "bg-blue-50 text-blue-700"
                  : staff.id_primary_position === 2
                  ? "bg-green-50 text-green-700"
                  : "bg-purple-50 text-purple-700"
              }`}
            >
              {staff.positions?.name ??
                POSITION_LABELS[staff.id_primary_position] ??
                "—"}
            </span>
            {staff.is_active ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                Actif
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                Inactif
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() =>
            updateStaff.mutate({
              id: staff.id_staff,
              data: { is_active: !staff.is_active },
            })
          }
          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            staff.is_active
              ? "border-red-200 text-red-600 hover:bg-red-50"
              : "border-green-200 text-green-600 hover:bg-green-50"
          }`}
        >
          {staff.is_active ? "Désactiver" : "Activer"}
        </button>
      </div>
    </div>
  );
}
