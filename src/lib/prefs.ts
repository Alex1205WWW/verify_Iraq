import "server-only";
import { cookies } from "next/headers";
import { dict, isLang, type Dict, type Lang } from "./i18n";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const LANG_COOKIE = "vd_lang";
export const THEME_COOKIE = "vd_theme";

export function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

/**
 * Both preferences live in plain cookies rather than in localStorage, so the
 * server already knows them when it renders the first byte. That is what stops
 * the page flashing the wrong theme, and what lets Arabic pages be delivered
 * with dir="rtl" already set instead of flipping after hydration.
 */
export async function getLang(): Promise<Lang> {
  const raw = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(raw) ? raw : "en";
}

export async function getTheme(): Promise<Theme> {
  const raw = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(raw) ? raw : "system";
}

export async function getT(): Promise<Dict> {
  return dict(await getLang());
}
