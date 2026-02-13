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
}

export function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;
  const isPlaceholder = !value;

  const handleOpen = () => {
    if (btnRef.current) {
      setAnchor(btnRef.current.getBoundingClientRect());
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-sm transition-all",
          "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
          open
            ? "border-primary/40 bg-white shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
          isPlaceholder ? "text-slate-400" : "text-slate-700"
        )}
      >
        <span className="truncate max-w-[140px]">{selectedLabel}</span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-slate-400 transition-transform",
          open && "rotate-180"
        )} />
      </button>

      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)}>
        <div className="py-1 max-h-[240px] overflow-y-auto">
          {/* Placeholder / "All" option */}
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
