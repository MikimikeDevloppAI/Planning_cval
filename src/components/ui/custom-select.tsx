"use client";

import { useRef, useState } from "react";
import { ChevronDown, Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "./popover";

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Show the placeholder as a selectable "all" option (for filters). Default: false */
  allowEmpty?: boolean;
  /** Compact size for inline edits */
  size?: "default" | "compact";
  /** Additional classes on the trigger button */
  className?: string;
  /** Disable the select */
  disabled?: boolean;
  /** When provided, shows a "Créer" input at the top of the dropdown */
  onCreate?: (name: string) => void;
  /** Label for the create action. Default: "Créer..." */
  createLabel?: string;
  /** Whether the create mutation is pending */
  isCreating?: boolean;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  allowEmpty = false,
  size = "default",
  className,
  disabled = false,
  onCreate,
  createLabel = "Créer...",
  isCreating = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;
  const isPlaceholder = !value;

  const handleOpen = () => {
    if (disabled) return;
    if (btnRef.current) {
      setAnchor(btnRef.current.getBoundingClientRect());
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setShowCreate(false);
    setCreateName("");
  };

  const handleCreate = () => {
    if (!createName.trim() || !onCreate) return;
    onCreate(createName.trim());
    setCreateName("");
    setShowCreate(false);
    setOpen(false);
  };

  const isCompact = size === "compact";

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-between gap-1.5 border transition-all",
          "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
          isCompact
            ? "h-7 px-2 text-xs rounded-md"
            : "h-[38px] px-3 text-sm rounded-xl",
          open
            ? "border-primary/40 bg-white shadow-sm"
            : "border-border/50 bg-muted/30 hover:border-slate-300 hover:shadow-sm",
          isPlaceholder ? "text-slate-500" : "text-slate-700",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={cn(
          "shrink-0 text-slate-400 transition-transform",
          isCompact ? "w-3 h-3" : "w-3.5 h-3.5",
          open && "rotate-180",
        )} />
      </button>

      <Popover anchor={anchor} open={open} onClose={handleClose} matchWidth>
        <div className="py-1 max-h-[240px] overflow-y-auto">
          {/* Create new option — at the top */}
          {onCreate && (
            showCreate ? (
              <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/20">
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setShowCreate(false);
                      setCreateName("");
                    }
                  }}
                  placeholder={createLabel}
                  className="flex-1 min-w-0 rounded border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  disabled={!createName.trim() || isCreating}
                  className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-40"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setCreateName("");
                  }}
                  className="p-0.5 text-muted-foreground hover:bg-muted/50 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[13px] text-primary font-medium hover:bg-primary/5 transition-colors border-b border-border/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{createLabel}</span>
              </button>
            )
          )}

          {/* "All" / empty option — only when allowEmpty is true */}
          {allowEmpty && (
            <button
              onClick={() => {
                onChange("");
                handleClose();
              }}
              className={cn(
                "flex items-center gap-2 w-full text-left px-3 py-2 text-[13px] transition-colors",
                !value
                  ? "bg-primary/5 text-primary font-medium"
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {!value && <Check className="w-3.5 h-3.5" />}
              {!value ? <span>{placeholder}</span> : <span className="ml-5.5">{placeholder}</span>}
            </button>
          )}

          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  handleClose();
                }}
                className={cn(
                  "flex items-center gap-2 w-full text-left px-3 py-2 text-[13px] transition-colors",
                  isSelected
                    ? "bg-primary/5 text-primary font-medium"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                {isSelected ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5" />}
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
