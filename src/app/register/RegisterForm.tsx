"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction, type FormState } from "@/actions/auth";
import { useT } from "@/components/Intl";
import { EXPERTISE } from "@/lib/types";

export default function RegisterForm() {
  const t = useT();
  const [role, setRole] = useState<"client" | "researcher">("client");
  const [state, action, pending] = useActionState<FormState, FormData>(
    registerAction,
    null,
  );

  return (
    <>
      <div className="brandline">
        <div>
          <h1 style={{ fontSize: 20 }}>{t.auth.applyTitle}</h1>
          <p className="small dim" style={{ margin: 0 }}>
            {t.auth.applySub}
          </p>
        </div>
      </div>

      <form action={action} className="card">
        <div className="pad stack">
          {state?.error && <div className="notice bad">{state.error}</div>}

          <div className="field">
            <label htmlFor="role">{t.auth.iAm}</label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "client" | "researcher")}
            >
              <option value="client">{t.auth.iAmCompany}</option>
              <option value="researcher">{t.auth.iAmResearcher}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="fullName">{t.auth.yourName}</label>
            <input id="fullName" name="fullName" type="text" required />
          </div>

          {role === "client" && (
            <div className="field">
              <label htmlFor="companyName">{t.auth.companyName}</label>
              <input id="companyName" name="companyName" type="text" required />
            </div>
          )}

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
              autoComplete="new-password"
              required
              minLength={8}
            />
            <span className="hint">{t.auth.passwordHint}</span>
          </div>

          <div className="grid two" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="country">{t.auth.country}</label>
              <input id="country" name="country" type="text" required />
            </div>
            <div className="field">
              <label htmlFor="city">{t.auth.city}</label>
              <input id="city" name="city" type="text" required />
            </div>
          </div>

          <div className="field">
            <label htmlFor="phone">{t.auth.phone}</label>
            <input id="phone" name="phone" type="tel" required />
          </div>

          {role === "researcher" && (
            <>
              <div className="field">
                <label htmlFor="whatsappNumber">{t.auth.whatsapp}</label>
                <input
                  id="whatsappNumber"
                  name="whatsappNumber"
                  type="tel"
                  placeholder={t.auth.whatsappPlaceholder}
                />
                <span className="hint">{t.auth.whatsappHint}</span>
              </div>

              <div className="field">
                <label>{t.auth.whatYouCanDo}</label>
                <div className="stack tight">
                  {EXPERTISE.map((item) => (
                    <label className="checkline" key={item}>
                      <input type="checkbox" name="expertise" value={item} />
                      {(t.expertise as Record<string, string>)[item] ?? item}
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor="coverageNote">{t.auth.coverage}</label>
                <textarea
                  id="coverageNote"
                  name="coverageNote"
                  placeholder={t.auth.coveragePlaceholder}
                />
              </div>
            </>
          )}

          <button className="btn primary block" type="submit" disabled={pending}>
            {pending ? t.common.sending : t.auth.sendApplication}
          </button>

          <p className="small dim" style={{ textAlign: "center", margin: 0 }}>
            {t.auth.haveAccount} <Link href="/login">{t.common.signIn}</Link>
          </p>
        </div>
      </form>
    </>
  );
}
