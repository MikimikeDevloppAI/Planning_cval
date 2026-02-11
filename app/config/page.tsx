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
    <div>
      <p className="text-gray-500 mb-6">
        Configurez les paramètres de votre système de planning.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CONFIG_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="flex items-start gap-4 p-5 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                  {card.label}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">{card.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
