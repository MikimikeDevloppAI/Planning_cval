"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="flex-1">{label}</span>
    </Link>
  );
}

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();
  const [planningOpen, setPlanningOpen] = useState(true);

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-5 border-b border-border/50">
        <Image
          src="/logo-clival.png"
          alt="CLIVAL"
          width={140}
          height={61}
          className="h-9 w-auto"
          priority
        />
      </div>

      {/* Navigation with Accordion */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Planning Section - Accordion */}
        <div className="space-y-1">
          <button
            onClick={() => setPlanningOpen(!planningOpen)}
            className="flex items-center w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
          >
            <span className="flex-1 text-left">Planning</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                planningOpen && "rotate-180"
              )}
            />
          </button>

          <div
            className={cn(
              "overflow-hidden transition-all duration-200",
              planningOpen
                ? "max-h-96 opacity-100"
                : "max-h-0 opacity-0"
            )}
          >
            <div className="space-y-1">
              <NavLink
                href="/planning"
                icon={LayoutDashboard}
                label="Dashboard"
                active={isActive("/planning")}
                onClick={onLinkClick}
              />
              <NavLink
                href="/staff"
                icon={Users}
                label="Personnel"
                active={isActive("/staff")}
                onClick={onLinkClick}
              />
            </div>
          </div>
        </div>

        {/* Fixed Links below separator */}
        <div className="mt-6 pt-6 border-t border-border/50 space-y-1">
          <NavLink
            href="/config"
            icon={Settings}
            label="Configuration"
            active={isActive("/config")}
            onClick={onLinkClick}
          />
        </div>
      </nav>

      {/* Bottom section */}
      <div className="shrink-0 p-4 border-t border-border/50">
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shrink-0">
              <span className="text-sm font-medium text-primary-foreground">
                A
              </span>
            </div>
            <span className="text-sm font-medium text-foreground flex-1 truncate">
              Admin
            </span>
            <button className="text-muted-foreground hover:text-destructive transition-colors" title="Déconnexion">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar - Fixed left */}
      <div className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:w-64 lg:bg-card lg:border-r lg:border-border">
        <SidebarContent />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-card border-b border-border flex items-center px-4">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
        <div className="ml-3">
          <Image
            src="/logo-clival.png"
            alt="CLIVAL"
            width={120}
            height={52}
            className="h-7 w-auto"
          />
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent onLinkClick={() => setMobileOpen(false)} />
      </aside>
    </>
  );
}
