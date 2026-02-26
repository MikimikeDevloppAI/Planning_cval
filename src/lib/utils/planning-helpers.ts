import type React from "react";
import { SITE_ABBREV } from "@/lib/constants";

/** Border-left pour séparateurs de semaine */
export function weekSepStyle(
  isWkStart: boolean,
  isFirstCol: boolean
): React.CSSProperties | undefined {
  if (isWkStart && !isFirstCol) {
    return { borderLeft: "2px solid rgb(203 213 225)" };
  }
  return undefined;
}

/** Abrège un nom de site connu, sinon prend les 4 premiers caractères */
export function abbreviateSite(name: string): string {
  return SITE_ABBREV[name.toLowerCase().trim()] ?? name.slice(0, 4).toUpperCase();
}

/** Abrège un nom de département si > 10 caractères */
export function abbreviateDept(name: string): string {
  return name.length <= 10 ? name : name.slice(0, 9) + ".";
}
