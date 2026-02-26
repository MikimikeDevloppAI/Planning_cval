"use client";

import { useState } from "react";
import { useAddLeave, useDeleteLeave, useUpdateLeave } from "@/hooks/use-staff";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Trash2, CalendarOff, Pencil, Check, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";

const PERIOD_OPTIONS = [
  { value: "AM", label: "Matin (AM)" },
  { value: "PM", label: "Après-midi (PM)" },
];


interface LeaveEntry {
  id_leave: number;
  start_date: string;
  end_date: string;
  period: "AM" | "PM" | null;
}

interface StaffLeaveManagerProps {
  staffId: number;
  leaves: LeaveEntry[];
  showForm: boolean;
  onToggleForm: (show: boolean) => void;
}

export function StaffLeaveManager({ staffId, leaves, showForm, onToggleForm }: StaffLeaveManagerProps) {
  const addLeave = useAddLeave();
  const deleteLeave = useDeleteLeave();
  const updateLeave = useUpdateLeave();

  const [confirmDelete, setConfirmDelete] = useState<LeaveEntry | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Add form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [period, setPeriod] = useState<"AM" | "PM" | "">("");

  // Edit form state
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editPeriod, setEditPeriod] = useState<"AM" | "PM" | "">("");

  const handleAdd = () => {
    if (!startDate || !endDate) return;
    addLeave.mutate(
      {
        staffId,
        data: {
          start_date: startDate,
          end_date: endDate,
          period: period || null,
        },
      },
      {
        onSuccess: () => {
          onToggleForm(false);
          setStartDate("");
          setEndDate("");
          setPeriod("");
        },
      }
    );
  };

  const startEdit = (leave: LeaveEntry) => {
    setEditingId(leave.id_leave);
    setEditStart(leave.start_date);
    setEditEnd(leave.end_date);
    setEditPeriod(leave.period ?? "");
  };

  const handleUpdate = () => {
    if (!editingId || !editStart || !editEnd) return;
    updateLeave.mutate(
      {
        staffId,
        leaveId: editingId,
        data: {
          start_date: editStart,
          end_date: editEnd,
          period: editPeriod || null,
        },
      },
      {
        onSuccess: () => setEditingId(null),
      }
    );
  };

  const formatDate = (d: string) => {
    try {
      return format(parseISO(d), "dd MMM yyyy", { locale: fr });
    } catch {
      return d;
    }
  };

  const periodLabel = (p: "AM" | "PM" | null) => {
    if (p === "AM") return "Matin";
    if (p === "PM") return "Après-midi";
    return "Journée complète";
  };

  // Only show future / current leaves
  const today = new Date().toISOString().split("T")[0];
  const activeLeaves = leaves.filter((l) => l.end_date >= today);

  return (
    <div className="space-y-3">
      {/* Add form */}
      {showForm && (
        <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Date début
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate) setEndDate(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 hover:shadow-sm transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Date fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 hover:shadow-sm transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Période
            </label>
            <CustomSelect
              value={period}
              onChange={(v) => setPeriod(v as "AM" | "PM" | "")}
              options={PERIOD_OPTIONS}
              placeholder="Journée complète"
              allowEmpty
              className="w-full"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => onToggleForm(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded-xl"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={!startDate || !endDate || addLeave.isPending}
              className="px-3 py-1.5 text-sm bg-warning text-white rounded-xl hover:bg-warning/90 disabled:opacity-50"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {activeLeaves.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground">
          <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
            <CalendarOff className="w-7 h-7" />
          </div>
          <p className="text-sm">Aucune absence à venir</p>
        </div>
      )}

      {/* Active leaves */}
      {activeLeaves.length > 0 && (
        <div className="space-y-2">
          {activeLeaves.map((leave) => {
            const isEditing = editingId === leave.id_leave;

            if (isEditing) {
              return (
                <div
                  key={leave.id_leave}
                  className="bg-muted/30 rounded-xl border border-primary/30 p-3 space-y-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                        Début
                      </label>
                      <input
                        type="date"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                        Fin
                      </label>
                      <input
                        type="date"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-slate-300 transition-all"
                      />
                    </div>
                  </div>
                  <CustomSelect
                    value={editPeriod}
                    onChange={(v) => setEditPeriod(v as "AM" | "PM" | "")}
                    options={PERIOD_OPTIONS}
                    placeholder="Journée complète"
                    allowEmpty
                    size="compact"
                    className="w-full"
                  />
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleUpdate}
                      disabled={!editStart || !editEnd || updateLeave.isPending}
                      className="p-1.5 text-success hover:bg-success/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={leave.id_leave}
                className="flex items-center justify-between bg-warning/5 border border-warning/20 rounded-xl px-4 py-2.5 group"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatDate(leave.start_date)}
                    {leave.start_date !== leave.end_date &&
                      ` → ${formatDate(leave.end_date)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {periodLabel(leave.period)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(leave)}
                    className="text-muted-foreground/40 hover:text-primary p-1 rounded-lg hover:bg-primary/5 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(leave)}
                    className="text-destructive/50 hover:text-destructive p-1 rounded-lg hover:bg-destructive/5 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        variant="danger"
        title="Supprimer cette absence ?"
        message={
          confirmDelete
            ? `L'absence du ${formatDate(confirmDelete.start_date)}${
                confirmDelete.start_date !== confirmDelete.end_date
                  ? ` au ${formatDate(confirmDelete.end_date)}`
                  : ""
              } sera supprimée.`
            : ""
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (confirmDelete) {
            deleteLeave.mutate(
              { staffId, leaveId: confirmDelete.id_leave },
              { onSuccess: () => setConfirmDelete(null) }
            );
          }
        }}
        onCancel={() => setConfirmDelete(null)}
        isPending={deleteLeave.isPending}
      />
    </div>
  );
}
