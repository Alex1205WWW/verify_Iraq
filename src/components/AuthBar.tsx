"use client";

import { LangSwitch, ThemeSwitch } from "./PrefsControls";
import { useLang } from "./Intl";

/**
 * Language and theme need to be reachable before anybody signs in — a
 * researcher who only reads Arabic should not have to guess their way through
 * an English login screen first.
 */
export default function AuthBar({ theme }: { theme: "system" | "light" | "dark" }) {
  const lang = useLang();
  return (
    <div className="row" style={{ justifyContent: "flex-end", marginBottom: 14 }}>
      <LangSwitch current={lang} />
      <ThemeSwitch current={theme} />
    </div>
  );
}
