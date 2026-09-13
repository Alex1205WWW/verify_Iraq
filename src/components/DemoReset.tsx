"use client";

import { useTransition } from "react";
import { resetDemoAction } from "@/actions/demo";
import { useT } from "./Intl";

/**
 * Called from a click rather than bound to a <form action>, so no action id
 * is rendered into the page markup alongside the page's own forms.
 */
export default function DemoReset() {
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <div className="demo-tools">
      <p className="grouplabel">{t.demo.label}</p>
      <p className="small dim">{t.demo.banner}</p>
      <button
        type="button"
        className="btn sm block"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t.demo.resetConfirm)) return;
          startTransition(async () => {
            await resetDemoAction();
          });
        }}
      >
        {pending ? t.demo.resetting : t.demo.reset}
      </button>
    </div>
  );
}
