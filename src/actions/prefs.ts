"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLang } from "@/lib/i18n";
import { isTheme, LANG_COOKIE, THEME_COOKIE } from "@/lib/prefs";

const YEAR = 60 * 60 * 24 * 365;

export async function setLang(value: string) {
  if (!isLang(value)) return;
  const jar = await cookies();
  jar.set(LANG_COOKIE, value, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setTheme(value: string) {
  if (!isTheme(value)) return;
  const jar = await cookies();
  jar.set(THEME_COOKIE, value, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}
