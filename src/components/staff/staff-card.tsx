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
      {/* Back button */}
      <Link
        href="/staff"
        className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg px-3 py-1.5 transition-all mb-4"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Personnel
      </Link>

      {/* Profile card — Premium design */}
      <div className="bg-card rounded-2xl shadow-soft border border-border/40 overflow-hidden mb-6">
        {/* Gradient header band */}
        <div
          className="h-24 relative"
          style={{
            background: `linear-gradient(135deg, ${colors.hex}20, ${colors.hex}08)`,
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute -top-12 -right-12 w-40 h-40 rounded-full"
            style={{ backgroundColor: colors.hex, opacity: 0.06 }}
          />
          <div
            className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full"
            style={{ backgroundColor: colors.hex, opacity: 0.04 }}
          />
        </div>

        <div className="px-6 pb-6 -mt-10 relative">
          <div className="flex items-end gap-5">
            {/* Large avatar — overlapping the gradient band */}
            <div
              className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0",
                "ring-4 ring-card shadow-lg",
                colors.avatar
              )}
            >
              {getInitials(staff.firstname, staff.lastname)}
            </div>

            <div className="flex-1 min-w-0 pb-1">
              {/* Editable name */}
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    value={firstname}
                    onChange={(e) => setFirstname(e.target.value)}
                    className="text-lg font-semibold text-foreground border border-border/50 rounded-xl px-3 py-1.5 w-40 bg-card focus:ring-2 focus:ring-primary/30 outline-none"
                    placeholder="Prénom"
                  />
                  <input
                    value={lastname}
                    onChange={(e) => setLastname(e.target.value)}
                    className="text-lg font-semibold text-foreground border border-border/50 rounded-xl px-3 py-1.5 w-40 bg-card focus:ring-2 focus:ring-primary/30 outline-none"
                    placeholder="Nom"
                  />
                  <button
                    onClick={handleSave}
                    disabled={updateStaff.isPending}
                    className="p-2 text-success hover:bg-success/10 rounded-xl transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setFirstname(staff.firstname);
                      setLastname(staff.lastname);
                      setEditing(false);
                    }}
                    className="p-2 text-muted-foreground hover:bg-muted rounded-xl transition-colors"
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
                    "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold",
                    colors.badge
                  )}
                >
                  {staff.positions?.name ??
                    POSITION_LABELS[staff.id_primary_position] ??
                    "—"}
                </span>
                {staff.is_active ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-success/8 text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
                    Actif
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
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
