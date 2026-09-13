"use client";

import { createContext, useContext } from "react";
import { dict, type Dict, type Lang } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; t: Dict }>({
  lang: "en",
  t: dict("en"),
});

export function IntlProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ lang, t: dict(lang) }}>{children}</Ctx.Provider>;
}

/** Client components read the dictionary from context rather than props. */
export function useT(): Dict {
  return useContext(Ctx).t;
}

export function useLang(): Lang {
  return useContext(Ctx).lang;
}
