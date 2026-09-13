import type { Metadata, Viewport } from "next";
import { IntlProvider } from "@/components/Intl";
import { dirFor } from "@/lib/i18n";
import { getLang, getTheme } from "@/lib/prefs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verification Dispatch",
  description:
    "Field verification dispatch — companies file tasks, the operator assigns a researcher, evidence comes back through the platform.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lang, theme] = await Promise.all([getLang(), getTheme()]);

  return (
    // The language and theme are read from cookies on the server, so the first
    // byte already carries dir="rtl" and the right theme. Nothing flips after
    // hydration and there is no flash of the wrong palette.
    //
    // suppressHydrationWarning covers the two things outside React's control
    // here: browser extensions that decorate <html>/<body>, and the theme
    // attribute the switch writes directly to the DOM before the server
    // re-render lands.
    <html
      lang={lang}
      dir={dirFor(lang)}
      data-theme={theme === "system" ? undefined : theme}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <IntlProvider lang={lang}>{children}</IntlProvider>
      </body>
    </html>
  );
}
