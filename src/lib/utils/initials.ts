/**
 * Extract initials from a first and last name.
 * "Lucie" "Bron" -> "LB"
 */
export function getInitials(firstname: string, lastname: string): string {
  const f = firstname?.trim()?.[0]?.toUpperCase() ?? "";
  const l = lastname?.trim()?.[0]?.toUpperCase() ?? "";
  return f + l;
}

/**
 * Build a map of disambiguated initials for a list of people.
 * When two people share the same 2-letter initials (e.g. SK for Sonia Kerkour
 * and Soydan Kurun), adds the 2nd letter of the lastname to differentiate:
 * "SKe" vs "SKu".
 */
export function buildInitialsMap(
  people: { id_staff: number; firstname: string; lastname: string }[]
): Map<number, string> {
  const baseMap = new Map<number, string>();
  const collisions = new Map<string, number[]>();

  for (const p of people) {
    const base = getInitials(p.firstname, p.lastname);
    baseMap.set(p.id_staff, base);
    if (!collisions.has(base)) collisions.set(base, []);
    collisions.get(base)!.push(p.id_staff);
  }

  for (const [, ids] of collisions) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      const p = people.find((x) => x.id_staff === id)!;
      const extra = p.lastname?.trim()?.[1]?.toLowerCase() ?? "";
      baseMap.set(id, baseMap.get(id)! + extra);
    }
  }

  return baseMap;
}

/**
 * Format a name as "Lastname F." for compact display.
 */
export function formatNameShort(firstname: string, lastname: string): string {
  return `${lastname} ${firstname?.[0]?.toUpperCase() ?? ""}.`;
}
