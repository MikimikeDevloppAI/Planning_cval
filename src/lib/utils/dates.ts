import {
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  subWeeks,
  addDays,
  format,
  getDay,
} from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Get the Monday (start) of the ISO week containing the given date.
 */
export function getWeekStart(date: Date): Date {
  return startOfISOWeek(date);
}

/**
 * Get the 6 working days (Mon-Sat) for a given week start.
 */
export function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 6; i++) {
    days.push(addDays(weekStart, i));
  }
  return days;
}

/**
 * Format a date as "Lundi 09/02".
 */
export function formatDayLabel(date: Date): string {
  return format(date, "EEEE dd/MM", { locale: fr });
}

/**
 * Format a date as "dd/MM".
 */
export function formatDayShort(date: Date): string {
  return format(date, "dd/MM");
}

/**
 * Format week range as "Sem. du 09 fév. au 14 fév. 2026".
 */
export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 5); // Saturday
  const start = format(weekStart, "dd MMM", { locale: fr });
  const end = format(weekEnd, "dd MMM yyyy", { locale: fr });
  return `Sem. du ${start} au ${end}`;
}

/**
 * Format date as ISO string (YYYY-MM-DD).
 */
export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Check if a date is Saturday (index 6).
 */
export function isSaturday(date: Date): boolean {
  return getDay(date) === 6;
}

export { addWeeks, subWeeks, startOfISOWeek, endOfISOWeek, addDays, fr };
