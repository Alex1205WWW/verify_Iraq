"use client";

import { useTransition } from "react";
import { setLang, setTheme } from "@/actions/prefs";
import { LANG_NAME, LANGS, type Lang } from "@/lib/i18n";
import { useT } from "./Intl";

type Theme = "system" | "light" | "dark";

/**
 * Both controls write a cookie and let the server re-render. The DOM is also
 * updated immediately so the change is instant rather than waiting on the
 * round trip — the server render that follows agrees with it.
 */
export function LangSwitch({ current }: { current: Lang }) {
  const [busy, start] = useTransition();
  const t = useT();

  return (
    <label className="prefctl" title={t.common.language}>
      <span className="sronly">{t.common.language}</span>
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M1.7 8h12.6M8 1.7c1.7 1.8 2.6 4 2.6 6.3S9.7 12.5 8 14.3C6.3 12.5 5.4 10.3 5.4 8S6.3 3.5 8 1.7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
      <select
        value={current}
        disabled={busy}
        aria-label={t.common.language}
        onChange={(e) => {
          const next = e.target.value as Lang;
          document.documentElement.lang = next;
          document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
          start(async () => void (await setLang(next)));
        }}
      >
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {LANG_NAME[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ThemeSwitch({ current }: { current: Theme }) {
  const [busy, start] = useTransition();
  const t = useT();

  const order: Theme[] = ["system", "light", "dark"];
  const label: Record<Theme, string> = {
    system: t.common.themeSystem,
    light: t.common.themeLight,
    dark: t.common.themeDark,
  };

  function applyToDom(next: Theme) {
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
  }

  return (
    <button
      type="button"
      className="prefctl asbtn"
      disabled={busy}
      title={`${t.common.theme}: ${label[current]}`}
      aria-label={`${t.common.theme}: ${label[current]}`}
      onClick={() => {
        const next = order[(order.indexOf(current) + 1) % order.length];
        applyToDom(next);
        start(async () => void (await setTheme(next)));
      }}
    >
      {current === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a5.9 5.9 0 1 0 7 7Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      ) : current === "light" ? (
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M8 .9v2M8 13.1v2M.9 8h2M13.1 8h2M3 3l1.4 1.4M11.6 11.6 13 13M13 3l-1.4 1.4M4.4 11.6 3 13"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 1.7v12.6A6.3 6.3 0 0 0 8 1.7Z" fill="currentColor" />
        </svg>
      )}
      <span className="prefctl-text">{label[current]}</span>
    </button>
  );
}
