"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  isPending?: boolean;
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "default",
  isPending,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmColors =
    variant === "danger"
      ? "bg-destructive text-white hover:bg-destructive/90"
      : variant === "warning"
        ? "bg-warning text-white hover:bg-warning/90"
        : "bg-primary text-primary-foreground hover:bg-primary-hover";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in-up"
        style={{ animationDuration: "150ms" }}
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-card rounded-2xl shadow-xl border border-border/40 w-full max-w-sm mx-4 animate-fade-in-up overflow-hidden"
        style={{ animationDuration: "200ms" }}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            {variant === "danger" && (
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4.5 h-4.5 text-destructive" />
              </div>
            )}
            {variant === "warning" && (
              <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4.5 h-4.5 text-warning" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{message}</p>
            </div>
            <button
              onClick={onCancel}
              className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border/30 bg-muted/20">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50",
              confirmColors
            )}
          >
            {isPending ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
