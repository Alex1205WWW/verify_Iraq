"use client";

import { useState, useTransition } from "react";
import { setAvailability } from "@/actions/researcher";
import { forceCloseTask, offerTask, simulateOfferResponse } from "@/actions/admin";
import { markComplete, startWork } from "@/actions/tasks";
import { useT } from "./Intl";

/** Researcher's Available / Unavailable switch. */
export function AvailabilityToggle({ initial }: { initial: boolean }) {
  const t = useT();
  const [on, setOn] = useState(initial);
  const [busy, start] = useTransition();

  return (
    <button
      type="button"
      className={`btn ${on ? "ok" : ""}`}
      disabled={busy}
      aria-pressed={on}
      onClick={() =>
        start(async () => {
          const next = !on;
          setOn(next);
          await setAvailability(next);
        })
      }
    >
      <span
        aria-hidden="true"
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: on ? "var(--ok)" : "var(--muted)",
        }}
      />
      {on ? t.researcher.availableForWork : t.researcher.unavailable}
    </button>
  );
}

export function StartWorkButton({ taskId }: { taskId: string }) {
  const t = useT();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      className="btn primary"
      disabled={busy}
      onClick={() => start(async () => void (await startWork(taskId)))}
    >
      {busy ? t.researcher.starting : t.researcher.startWork}
    </button>
  );
}

export function CompleteButton({
  taskId,
  alreadyDone,
}: {
  taskId: string;
  alreadyDone: boolean;
}) {
  const t = useT();
  const [busy, start] = useTransition();
  if (alreadyDone) {
    return <span className="pill ok">{t.client.youMarked}</span>;
  }
  return (
    <button
      type="button"
      className="btn ok"
      disabled={busy}
      onClick={() => start(async () => void (await markComplete(taskId)))}
    >
      {busy ? t.common.saving : t.client.markComplete}
    </button>
  );
}

export function OfferButton({
  taskId,
  researcherId,
  disabled,
}: {
  taskId: string;
  researcherId: string;
  disabled?: boolean;
}) {
  const t = useT();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="btn primary sm"
        disabled={busy || disabled}
        onClick={() =>
          start(async () => {
            try {
              setError(null);
              await offerTask(taskId, researcherId);
            } catch {
              setError(t.admin.couldNotOffer);
            }
          })
        }
      >
        {busy ? t.common.sending : t.admin.sendOffer}
      </button>
      {error && (
        <span className="small" style={{ color: "var(--bad)" }}>
          {error}
        </span>
      )}
    </>
  );
}

/** Only shown while WhatsApp runs in dry run, so the flow stays testable. */
export function SimulateReply({ offerId }: { offerId: string }) {
  const t = useT();
  const [busy, start] = useTransition();
  return (
    <span className="row" style={{ gap: 6 }}>
      <button
        type="button"
        className="btn ok sm"
        disabled={busy}
        onClick={() => start(async () => void (await simulateOfferResponse(offerId, true)))}
      >
        {t.admin.simulateAccept}
      </button>
      <button
        type="button"
        className="btn danger sm"
        disabled={busy}
        onClick={() => start(async () => void (await simulateOfferResponse(offerId, false)))}
      >
        {t.admin.simulateDecline}
      </button>
    </span>
  );
}

export function ForceCloseButton({ taskId }: { taskId: string }) {
  const t = useT();
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
        {t.admin.forceClose}
      </button>
    );
  }
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className="small dim">{t.admin.forceCloseConfirm}</span>
      <button
        type="button"
        className="btn danger sm"
        disabled={busy}
        onClick={() => start(async () => void (await forceCloseTask(taskId)))}
      >
        {busy ? t.admin.closing : t.admin.forceCloseYes}
      </button>
      <button type="button" className="btn sm" onClick={() => setConfirming(false)}>
        {t.common.cancel}
      </button>
    </span>
  );
}
