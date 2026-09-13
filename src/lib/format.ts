import type { Dict } from "./i18n";

// Dates are formatted with fixed month names rather than toLocaleString.
// Intl output differs between Node and the browser — different default locale,
// different timezone — and a client component that formats a date twice that
// way produces a hydration mismatch. Fixed formatting is identical everywhere,
// and client components are handed strings the server already built.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function asDate(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function clockTime(date: Date | string): string {
  const d = asDate(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fullStamp(date: Date | string): string {
  const d = asDate(date);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Relative time, translated. Server-side only — it reads the current clock. */
export function timeAgo(
  date: Date | string | null | undefined,
  t?: Dict,
): string {
  if (!date) return "—";
  const then = asDate(date);
  const secs = Math.floor((Date.now() - then.getTime()) / 1000);

  if (secs < 45) return t ? t.common.justNow : "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} ${t ? t.common.minAgo : "min ago"}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t ? ` ${t.common.hoursAgo}` : "h ago"}`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}${t ? ` ${t.common.daysAgo}` : "d ago"}`;
  return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
}

export function coords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Metres between two points. Used to flag a photo taken away from the site. */
export function distanceMetres(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export function prettyDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

/**
 * Strict coordinate parsing for form input.
 *
 * `Number("")` is 0, so a blank latitude field silently becomes a real, valid
 * looking position in the Atlantic. On a platform whose whole point is that a
 * photo can be trusted to have been taken somewhere, a missing fix must be
 * refused rather than rounded to null island.
 */
export function parseCoord(
  value: FormDataEntryValue | null,
  kind: "lat" | "lng",
): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) > (kind === "lat" ? 90 : 180) ? null : n;
}
