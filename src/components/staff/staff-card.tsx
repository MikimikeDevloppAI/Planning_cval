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
      ? "bg-[#e8f0fe] text-[#1a56db]"
      : staff.id_primary_position === 2
      ? "bg-[#e6f4ea] text-[#1e7e34]"
      : "bg-[#f3e8fd] text-[#6a1b9a]";

  const handleSave = () => {
    updateStaff.mutate(
      { id: staff.id_staff, data: { firstname, lastname } },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <div className="bg-card rounded-xl shadow-soft border border-border/50 p-6 mb-6">
      <div className="flex items-center gap-4">
        <Link
          href="/staff"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div
          className={`w-14 h-14 rounded-full ${posColor} flex items-center justify-center text-lg font-bold shrink-0`}
        >
          {getInitials(staff.firstname, staff.lastname)}
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                className="text-lg font-semibold text-foreground border border-border/50 rounded-lg px-2 py-1 w-40 bg-card focus:ring-2 focus:ring-ring outline-none"
                placeholder="Prénom"
              />
              <input
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                className="text-lg font-semibold text-foreground border border-border/50 rounded-lg px-2 py-1 w-40 bg-card focus:ring-2 focus:ring-ring outline-none"
                placeholder="Nom"
              />
              <button
                onClick={handleSave}
                disabled={updateStaff.isPending}
                className="p-1 text-success hover:bg-success/10 rounded-lg"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setFirstname(staff.firstname);
                  setLastname(staff.lastname);
                  setEditing(false);
                }}
                className="p-1 text-muted-foreground hover:bg-muted rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <h2
              className="text-xl font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
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
                  ? "bg-[#e8f0fe] text-[#1a56db]"
                  : staff.id_primary_position === 2
                  ? "bg-[#e6f4ea] text-[#1e7e34]"
                  : "bg-[#f3e8fd] text-[#6a1b9a]"
              }`}
            >
              {staff.positions?.name ??
                POSITION_LABELS[staff.id_primary_position] ??
                "—"}
            </span>
            {staff.is_active ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                Actif
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
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
          className={`text-sm px-3 py-1.5 rounded-xl border transition-all duration-200 ${
            staff.is_active
              ? "border-destructive/30 text-destructive hover:bg-destructive/5"
              : "border-success/30 text-success hover:bg-success/5"
          }`}
        >
          {staff.is_active ? "Désactiver" : "Activer"}
        </button>
      </div>
    </div>
  );
}
