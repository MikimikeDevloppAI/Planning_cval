"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PrimaryButton - Bouton principal avec couleur primary
 */
export const PrimaryButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 h-11 rounded-xl px-5",
        "bg-primary hover:bg-primary/90",
        "text-primary-foreground text-sm font-medium",
        "shadow-md shadow-primary/20",
        "hover:shadow-lg hover:shadow-primary/30",
        "transition-all",
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

PrimaryButton.displayName = "PrimaryButton";

/**
 * SecondaryButton - Bouton secondaire avec outline
 */
export const SecondaryButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 h-11 rounded-xl px-5",
        "border border-border/50 bg-transparent",
        "text-foreground text-sm font-medium",
        "hover:bg-primary/5 hover:border-primary/30",
        "transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

SecondaryButton.displayName = "SecondaryButton";

/**
 * TabButton - Bouton pour les onglets/tabs
 */
interface TabButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
}

export const TabButton = React.forwardRef<HTMLButtonElement, TabButtonProps>(
  ({ className, active, icon, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 md:flex-initial justify-center",
          active
            ? "bg-card text-foreground ring-1 ring-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          className
        )}
        {...props}
      >
        {icon}
        <span className="hidden sm:inline">{children}</span>
      </button>
    );
  }
);

TabButton.displayName = "TabButton";
