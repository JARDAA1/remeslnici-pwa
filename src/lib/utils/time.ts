/**
 * Time utilities that handle local timezone correctly.
 *
 * Core principle: all stored datetime strings represent the LOCAL time
 * the craftsman actually experienced. We never store UTC-shifted values
 * because the business meaning is "I started work at 8:00" — that's
 * local 8:00, not UTC 8:00.
 *
 * ISO strings are still used for serialization, but with the local
 * timezone offset appended (e.g. "2025-06-15T08:00:00+02:00").
 */

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Get current time as an ISO string WITH timezone offset.
 * Example: "2025-06-15T08:30:00+02:00"
 *
 * Unlike Date.toISOString() which returns UTC ("2025-06-15T06:30:00.000Z"),
 * this preserves the local time the user sees on their clock.
 */
export function nowLocalISO(): string {
  return toLocalISO(new Date());
}

/**
 * Convert a Date to an ISO string with local timezone offset.
 */
export function toLocalISO(d: Date): string {
  const offsetMin = d.getTimezoneOffset(); // e.g. -120 for CET+2
  const sign = offsetMin <= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const offH = pad(Math.floor(absMin / 60));
  const offM = pad(absMin % 60);

  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${offH}:${offM}`
  );
}

/**
 * Extract local YYYY-MM-DD date from any date-like value.
 * Uses the LOCAL date, not UTC — so 23:30 CET stays on the same day.
 */
export function toLocalDate(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
