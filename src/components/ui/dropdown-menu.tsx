"use client";

import type { LucideIcon } from "lucide-react";
import { Popover } from "./popover";

export interface DropdownMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export interface DropdownMenuSection {
  items: DropdownMenuItem[];
}

interface DropdownMenuProps {
  sections: DropdownMenuSection[];
  header?: React.ReactNode;
  anchor: DOMRect | null;
  open: boolean;
  onClose: () => void;
  align?: "start" | "center" | "end";
}

export function DropdownMenu({ sections, header, anchor, open, onClose, align }: DropdownMenuProps) {
  return (
    <Popover anchor={anchor} open={open} onClose={onClose} align={align}>
      <div className="py-1 min-w-[180px]">
        {header && (
          <div className="px-3 py-2 border-b border-slate-100">
            {header}
          </div>
        )}
        {sections.map((section, si) => (
          <div key={si}>
            {si > 0 && <div className="h-px bg-slate-100 my-1" />}
            {section.items.map((item, ii) => {
              const Icon = item.icon;
              const isDanger = item.variant === "danger";
              return (
                <button
                  key={ii}
                  onClick={() => {
                    if (!item.disabled) {
                      item.onClick();
                      onClose();
                    }
                  }}
                  disabled={item.disabled}
                  className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-[13px] rounded-lg mx-0 transition-colors ${
                    item.disabled
                      ? "text-slate-300 cursor-not-allowed"
                      : isDanger
                        ? "text-red-600 hover:bg-red-50"
                        : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Popover>
  );
}
