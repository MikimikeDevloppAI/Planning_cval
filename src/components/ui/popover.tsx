"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  anchor: DOMRect | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "start" | "center" | "end";
}

export function Popover({ anchor, open, onClose, children, align = "start" }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);

  // Calculate position when anchor changes
  useEffect(() => {
    if (!open || !anchor) return;

    const pad = 8;
    let top = anchor.bottom + pad;
    let left = align === "end"
      ? anchor.right
      : align === "center"
        ? anchor.left + anchor.width / 2
        : anchor.left;

    // Defer to next frame so the popover is rendered and measurable
    requestAnimationFrame(() => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();

      // Horizontal: keep in viewport
      if (align === "end") {
        left = left - rect.width;
      } else if (align === "center") {
        left = left - rect.width / 2;
      }
      if (left + rect.width > window.innerWidth - pad) {
        left = window.innerWidth - pad - rect.width;
      }
      if (left < pad) left = pad;

      // Vertical: flip above if no room below
      if (top + rect.height > window.innerHeight - pad) {
        top = anchor.top - pad - rect.height;
      }
      if (top < pad) top = pad;

      setPos({ top, left });
      setVisible(true);
    });

    return () => setVisible(false);
  }, [open, anchor, align]);

  // Close on click outside (delayed to avoid catching the event that opened the popover)
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Delay listener registration to next frame to avoid catching the opening event
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handle);
      document.addEventListener("keydown", handleKey);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open || !anchor) return null;

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[200] min-w-[160px]"
      style={{
        top: pos.top,
        left: pos.left,
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.95)",
        transition: "opacity 120ms ease-out, transform 120ms ease-out",
      }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-slate-200/60 backdrop-blur-sm overflow-hidden">
        {children}
      </div>
    </div>,
    document.body
  );
}
