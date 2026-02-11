const LEGEND_ITEMS = [
  { label: "Médecin", bg: "#e8f0fe", border: "#aecbfa" },
  { label: "Standard", bg: "#e6f4ea", border: "#a8dab5" },
  { label: "Aide fermeture", bg: "#fef3e0", border: "#f9cb80" },
  { label: "Fermeture", bg: "#fde7e9", border: "#f5a3ab" },
  { label: "Admin", bg: "#f3e8fd", border: "#ce93d8" },
  { label: "Chirurgie", bg: "#f5f5f5", border: "#ccc" },
];

const STATUS_ITEMS = [
  { label: "Proposé", borderStyle: "dashed" },
  { label: "Confirmé", borderStyle: "solid" },
  { label: "Publié", borderStyle: "solid", borderWidth: 2 },
];

export function PlanningLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
      {/* Rôles */}
      <div className="flex flex-wrap gap-3">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-sm border"
              style={{
                backgroundColor: item.bg,
                borderColor: item.border,
              }}
            />
            {item.label}
          </div>
        ))}
      </div>

      <span className="text-gray-300">|</span>

      {/* Statuts */}
      <div className="flex flex-wrap gap-3">
        {STATUS_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-sm bg-gray-100"
              style={{
                borderStyle: item.borderStyle as "dashed" | "solid",
                borderWidth: item.borderWidth ?? 1,
                borderColor: "#999",
              }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
