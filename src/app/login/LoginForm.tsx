"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/actions/auth";
import { useT } from "@/components/Intl";

// The demo's seeded accounts. The password is printed on this page anyway.
const DEMO_PASSWORD = "dispatch123";
const DEMO_LOGINS = [
  { role: "admin", email: "operator@dispatch.test" },
  { role: "client", email: "ops@gulfverify.test" },
  { role: "researcher", email: "ahmed@field.test" },
] as const;

export default function LoginForm() {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(
    loginAction,
    null,
  );

  return (
    <>
      <div className="brandline">
        <span
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "var(--accent)",
            color: "var(--accent-ink)",
            display: "grid",
            placeItems: "center",
            flex: "none",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path
              d="M8 1.5c-2.5 0-4.5 2-4.5 4.5 0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5c0-2.5-2-4.5-4.5-4.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="8" cy="6" r="1.6" fill="currentColor" />
          </svg>
        </span>
        <div>
          <h1 style={{ fontSize: 20 }}>{t.brand}</h1>
          <p className="small dim" style={{ margin: 0 }}>
            {t.auth.signInSub}
          </p>
        </div>
      </div>

      <form action={action} className="card">
        <div className="pad stack">
          {state?.error && <div className="notice bad">{state.error}</div>}

          <div className="field">
            <label htmlFor="email">{t.auth.email}</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div className="field">
            <label htmlFor="password">{t.auth.password}</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <button className="btn primary block" type="submit" disabled={pending}>
            {pending ? t.auth.signingIn : t.common.signIn}
          </button>

          <p className="small dim" style={{ textAlign: "center", margin: 0 }}>
            {t.auth.noAccount} <Link href="/register">{t.auth.applyToJoin}</Link>
          </p>
        </div>
      </form>

      <div className="notice" style={{ marginTop: 14 }}>
        <b>{t.auth.demoAccounts}</b>
        <p className="small" style={{ margin: "4px 0 10px" }}>
          {t.demo.banner}
        </p>
        <div className="stack tight">
          {DEMO_LOGINS.map((d) => (
            <form key={d.email} action={action}>
              <input type="hidden" name="email" value={d.email} />
              <input type="hidden" name="password" value={DEMO_PASSWORD} />
              <button type="submit" className="btn sm block demo-login" disabled={pending}>
                <span>
                  {t.demo.signInAs} <b>{t.role[d.role]}</b>
                </span>
                <span className="mono small dim" dir="ltr">
                  {d.email}
                </span>
              </button>
            </form>
          ))}
        </div>
        <div className="mono small dim" style={{ marginTop: 8 }} dir="ltr">
          {t.auth.demoPassword}
        </div>
      </div>
    </>
  );
}
