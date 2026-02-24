"use client";

import { useState, useEffect } from "react";
import { useUpdateSecretarySettings } from "@/hooks/use-staff";
import { Save, Loader2 } from "lucide-react";

interface StaffSettingsProps {
  staffId: number;
  settings: {
    is_flexible: boolean;
    flexibility_pct: number;
    full_day_only: boolean;
    admin_target: number;
  } | null;
}

export function StaffSettings({ staffId, settings }: StaffSettingsProps) {
  const update = useUpdateSecretarySettings();
  const [isFlexible, setIsFlexible] = useState(settings?.is_flexible ?? true);
  const [flexPct, setFlexPct] = useState(settings?.flexibility_pct ?? 50);
  const [fullDayOnly, setFullDayOnly] = useState(settings?.full_day_only ?? false);
  const [adminTarget, setAdminTarget] = useState(settings?.admin_target ?? 0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setIsFlexible(settings.is_flexible);
      setFlexPct(settings.flexibility_pct);
      setFullDayOnly(settings.full_day_only);
      setAdminTarget(settings.admin_target);
    }
  }, [settings]);

  const handleSave = () => {
    update.mutate(
      {
        id: staffId,
        data: {
          is_flexible: isFlexible,
          flexibility_pct: flexPct,
          full_day_only: fullDayOnly,
          admin_target: adminTarget,
        },
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  };

  return (
    <div className="space-y-5">
      {/* Flexible toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Flexible</p>
          <p className="text-xs text-muted-foreground">
            Peut être assignée à différents sites/départements
          </p>
        </div>
        <button
          onClick={() => setIsFlexible(!isFlexible)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            isFlexible ? "bg-primary" : "bg-border"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              isFlexible ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Flexibility percentage */}
      {isFlexible && (
        <div>
          <label className="flex items-center justify-between text-sm font-medium text-foreground mb-2">
            <span>Taux de flexibilité</span>
            <span className="text-primary font-semibold">{flexPct}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={flexPct}
            onChange={(e) => setFlexPct(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Full day only */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Journée complète uniquement</p>
          <p className="text-xs text-muted-foreground">
            Ne peut pas être assignée demi-journée
          </p>
        </div>
        <button
          onClick={() => setFullDayOnly(!fullDayOnly)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            fullDayOnly ? "bg-primary" : "bg-border"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              fullDayOnly ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Admin target */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Demi-journées admin par semaine
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          Nombre cible de demi-journées administratives
        </p>
        <input
          type="number"
          min={0}
          max={10}
          value={adminTarget}
          onChange={(e) => setAdminTarget(parseInt(e.target.value) || 0)}
          className="w-24 rounded-xl border border-border/50 bg-card px-3 py-2 text-sm text-center focus:ring-2 focus:ring-ring outline-none"
        />
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-xl hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-md shadow-primary/20"
        >
          {update.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Enregistrer
        </button>
        {saved && (
          <span className="text-sm text-success font-medium">Sauvegardé !</span>
        )}
      </div>
    </div>
  );
}
