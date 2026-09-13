import Link from "next/link";
import AuthBar from "@/components/AuthBar";
import { getT, getTheme } from "@/lib/prefs";

export default async function PendingPage() {
  const [t, theme] = await Promise.all([getT(), getTheme()]);
  return (
    <div className="authwrap">
      <div className="authcard">
        <AuthBar theme={theme} />
        <div className="card">
          <div className="pad stack">
            <span className="pill warn">{t.auth.pendingPill}</span>
            <h1 style={{ fontSize: 20 }}>{t.auth.pendingTitle}</h1>
            <p className="dim small">{t.auth.pendingBody}</p>
            <Link href="/login" className="btn block">
              {t.auth.backToSignIn}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
