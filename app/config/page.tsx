"use client";

import Link from "next/link";
import { Building2, Shield, Award, Layers, CalendarDays } from "lucide-react";

const CONFIG_CARDS = [
  {
    href: "/config/sites",
    label: "Sites & Départements",
    desc: "Gérer les sites et leurs départements",
    icon: Building2,
  },
  {
    href: "/config/roles",
    label: "Rôles",
    desc: "Rôles des secrétaires et poids de pénibilité",
    icon: Shield,
  },
  {
    href: "/config/skills",
    label: "Compétences",
    desc: "Compétences requises par département",
    icon: Award,
  },
  {
    href: "/config/tiers",
    label: "Paliers Staffing",
    desc: "Besoins en secrétaires selon le nombre de médecins",
    icon: Layers,
  },
  {
    href: "/config/calendar",
    label: "Calendrier",
    desc: "Jours fériés et jours spéciaux",
    icon: CalendarDays,
  },
];

export default function ConfigPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Inline header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/30 px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Configuration</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configurez les paramètres de votre système de planning.
        </p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CONFIG_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="flex items-start gap-4 p-5 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-md transition-all group"
              >
                <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {card.label}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{card.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
