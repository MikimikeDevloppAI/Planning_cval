"use client";

import { useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
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
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
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
            : "h-8 px-3 text-sm rounded-lg",
          open
            ? "border-primary/40 bg-white shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
          isPlaceholder ? "text-slate-400" : "text-slate-700",
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

      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} matchWidth>
        <div className="py-1 max-h-[240px] overflow-y-auto">
          {/* "All" / empty option — only when allowEmpty is true */}
          {allowEmpty && (
            <button
              onClick={() => {
                onChange("");
                setOpen(false);
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
                  setOpen(false);
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
