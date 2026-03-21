import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse une date "YYYY-MM-DD" en heure locale (sans décalage UTC).
 * new Date("2026-03-18") -> UTC minuit -> 23h le 17 en France -> BUG
 * parseLocalDate("2026-03-18") -> local minuit le 18 -> OK
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function aggregateByMonth(
  history: { value: number; date: string }[],
  mode: "average" | "sum"
): { label: string; v: number; date: string }[] {
  const byMonth: Record<string, number[]> = {};
  for (const entry of history) {
    const key = entry.date.slice(0, 7);
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(entry.value);
  }
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => {
      const val = mode === "sum"
        ? values.reduce((s, v) => s + v, 0)
        : Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
      const [year, month] = key.split("-");
      const monthLabel = new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString("fr-FR", { month: "short" });
      return { label: monthLabel, v: val, date: `${key}-01` };
    });
}
