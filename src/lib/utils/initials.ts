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
 * Format a name as "Lastname F." for compact display.
 */
export function formatNameShort(firstname: string, lastname: string): string {
  return `${lastname} ${firstname?.[0]?.toUpperCase() ?? ""}.`;
}
