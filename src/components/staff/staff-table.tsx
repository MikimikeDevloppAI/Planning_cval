"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStaffList } from "@/hooks/use-staff";
import { POSITION_LABELS } from "@/lib/constants";
import { getInitials } from "@/lib/utils/initials";
import {
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  Loader2,
  UserCircle2,
} from "lucide-react";

type SortKey = "lastname" | "position" | "is_active";
type SortDir = "asc" | "desc";

export function StaffTable() {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<number | "">("");
  const [activeFilter, setActiveFilter] = useState<string>("true");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "lastname",
    dir: "asc",
  });

  const { data: staffList, isLoading, error } = useStaffList({
    position: posFilter ? posFilter : undefined,
    active: activeFilter,
  });
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!staffList) return [];
    let list = [...staffList];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s: Record<string, unknown>) =>
          (s.lastname as string).toLowerCase().includes(q) ||
          (s.firstname as string).toLowerCase().includes(q)
      );
    }

    list.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      let cmp = 0;
      if (sort.key === "lastname") {
        cmp = (a.lastname as string).localeCompare(b.lastname as string);
      } else if (sort.key === "position") {
        cmp = (a.id_primary_position as number) - (b.id_primary_position as number);
      } else if (sort.key === "is_active") {
        cmp = (a.is_active === b.is_active) ? 0 : a.is_active ? -1 : 1;
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [staffList, search, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sort.key !== col) return <ChevronUp className="w-3 h-3 text-gray-300" />;
    return sort.dir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-blue-600" />
    ) : (
      <ChevronDown className="w-3 h-3 text-blue-600" />
    );
  };

  return (
    <div>
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={posFilter}
            onChange={(e) => setPosFilter(e.target.value ? parseInt(e.target.value) : "")}
            className="text-sm rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Toutes positions</option>
            {Object.entries(POSITION_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="text-sm rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
            <option value="all">Tous</option>
          </select>
        </div>

        <div className="text-sm text-gray-500">
          {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Chargement...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error.message}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12" />
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => toggleSort("lastname")}
                >
                  <div className="flex items-center gap-1">
                    Nom <SortIcon col="lastname" />
                  </div>
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => toggleSort("position")}
                >
                  <div className="flex items-center gap-1">
                    Position <SortIcon col="position" />
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Paramètres
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => toggleSort("is_active")}
                >
                  <div className="flex items-center gap-1">
                    Statut <SortIcon col="is_active" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((staff: Record<string, unknown>) => {
                const positionName =
                  (staff.positions as { name: string } | null)?.name ?? "—";
                const settings = staff.staff_secretary_settings as {
                  is_flexible?: boolean;
                  full_day_only?: boolean;
                  admin_target?: number;
                } | null;

                const posColor =
                  staff.id_primary_position === 1
                    ? "bg-blue-500"
                    : staff.id_primary_position === 2
                    ? "bg-green-500"
                    : "bg-purple-500";

                return (
                  <tr
                    key={staff.id_staff as number}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/staff/${staff.id_staff}`)}
                  >
                    <td className="px-4 py-3">
                      <div
                        className={`w-9 h-9 rounded-full ${posColor} flex items-center justify-center text-white text-xs font-bold`}
                      >
                        {getInitials(
                          staff.firstname as string,
                          staff.lastname as string
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm">
                        {staff.lastname as string} {staff.firstname as string}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          staff.id_primary_position === 1
                            ? "bg-blue-50 text-blue-700"
                            : staff.id_primary_position === 2
                            ? "bg-green-50 text-green-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {positionName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {(staff.id_primary_position as number) === 2 && settings ? (
                        <div className="flex items-center gap-2 text-xs">
                          {settings.is_flexible && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                              Flexible
                            </span>
                          )}
                          {settings.full_day_only && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                              JC uniquement
                            </span>
                          )}
                          {(settings.admin_target ?? 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                              Admin: {settings.admin_target}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {staff.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Inactif
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    <UserCircle2 className="w-8 h-8 mx-auto mb-2" />
                    Aucun résultat
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
