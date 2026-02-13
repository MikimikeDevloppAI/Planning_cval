"use client";

import { getInitials } from "@/lib/utils/initials";
import { getPositionColors } from "@/lib/utils/position-colors";
import { POSITION_LABELS } from "@/lib/constants";
import { useUpdateStaff } from "@/hooks/use-staff";
import { cn } from "@/lib/utils";
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

  const colors = getPositionColors(staff.id_primary_position);

  const handleSave = () => {
    updateStaff.mutate(
      { id: staff.id_staff, data: { firstname, lastname } },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <>
      {/* Back button — above the card */}
      <Link
        href="/staff"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg px-3 py-1.5 transition-all mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Personnel
      </Link>

      {/* Profile card */}
      <div className="bg-card rounded-xl shadow-soft border border-border/50 overflow-hidden mb-6">
        {/* Top gradient accent bar */}
        <div className={cn("h-1 bg-gradient-to-r", colors.gradient)} />

        <div className="p-6">
          <div className="flex items-center gap-5">
            {/* Large avatar — rounded square */}
            <div
              className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0",
                "ring-4 ring-offset-2 ring-offset-card",
                colors.avatar,
                colors.ring
              )}
            >
              {getInitials(staff.firstname, staff.lastname)}
            </div>

            <div className="flex-1 min-w-0">
              {/* Editable name */}
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
                    className="p-1.5 text-success hover:bg-success/10 rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setFirstname(staff.firstname);
                      setLastname(staff.lastname);
                      setEditing(false);
                    }}
                    className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <h2
                  className="text-xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
                  onClick={() => setEditing(true)}
                  title="Cliquer pour modifier"
                >
                  {staff.firstname} {staff.lastname}
                </h2>
              )}

              {/* Badges */}
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                    colors.badge
                  )}
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

            {/* Activate/Deactivate button */}
            <button
              onClick={() =>
                updateStaff.mutate({
                  id: staff.id_staff,
                  data: { is_active: !staff.is_active },
                })
              }
              className={cn(
                "text-sm px-4 py-2 rounded-xl border transition-all duration-200 font-medium",
                staff.is_active
                  ? "border-destructive/30 text-destructive hover:bg-destructive/5"
                  : "border-success/30 text-success hover:bg-success/5"
              )}
            >
              {staff.is_active ? "Désactiver" : "Activer"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
