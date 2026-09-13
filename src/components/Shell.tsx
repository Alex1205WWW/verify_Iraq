"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/actions/auth";
import { LangSwitch, ThemeSwitch } from "./PrefsControls";
import { useT } from "./Intl";
import type { Lang } from "@/lib/i18n";

export type NavItem = { href: string; label: string; count?: number };
export type NavGroup = { label: string; items: NavItem[] };

export default function Shell({
  roleLabel,
  userName,
  groups,
  lang,
  theme,
  railFooter,
  children,
}: {
  roleLabel: string;
  userName: string;
  groups: NavGroup[];
  lang: Lang;
  theme: "system" | "light" | "dark";
  /** Rendered under the navigation, e.g. the operator's demo tools. */
  railFooter?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useT();

  // Close the slide-over whenever navigation happens, or Escape is pressed.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isCurrent = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <div className="shell">
      <header className="topbar">
        <button
          type="button"
          className="burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            {open ? (
              <path
                d="M3 3 L15 15 M15 3 L3 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M2 4.5h14M2 9h14M2 13.5h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>

        <Link href="/" className="brand">
          <span className="mark" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 16 16">
              <path
                d="M8 1.5c-2.5 0-4.5 2-4.5 4.5 0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5c0-2.5-2-4.5-4.5-4.5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="8" cy="6" r="1.6" fill="currentColor" />
            </svg>
          </span>
          {t.brand}
          <small>{roleLabel}</small>
        </Link>

        <span className="spacer" />

        <LangSwitch current={lang} />
        <ThemeSwitch current={theme} />

        <span className="whoami">
          <b>{userName}</b>
        </span>
        <form action={logoutAction}>
          <button type="submit" className="btn sm">
            {t.common.signOut}
          </button>
        </form>
      </header>

      <div className="body-grid">
        {open && (
          <button
            type="button"
            className="scrim"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        )}

        <aside className="rail" data-open={open} id="main-nav">
          {groups.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <p className="grouplabel">{group.label}</p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                >
                  {item.label}
                  {typeof item.count === "number" && item.count > 0 && (
                    <span className="count">{item.count}</span>
                  )}
                </Link>
              ))}
            </nav>
          ))}
          {railFooter}
        </aside>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
