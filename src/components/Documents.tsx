"use client";

import { useActionState, useState } from "react";
import {
  reviewDocument,
  uploadDocument,
  type UploadState,
} from "@/actions/evidence";
import { useT } from "./Intl";

export type Submission = {
  id: string;
  slotLabel: string;
  version: number;
  fileName: string;
  storageKey: string;
  status: string;
  rejectionNote: string | null;
  /** Preformatted on the server — see the note in ChatPanel. */
  uploadedAt: string;
};

function tone(status: string) {
  return status === "accepted" ? "ok" : status === "rejected" ? "bad" : "warn";
}

/** One slot on the researcher's side: history plus a re-upload control. */
export function SlotUploader({
  taskId,
  slotLabel,
  history,
  locked,
}: {
  taskId: string;
  slotLabel: string;
  history: Submission[];
  locked: boolean;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<UploadState, FormData>(
    uploadDocument,
    null,
  );
  const latest = history[0];
  const accepted = latest?.status === "accepted";
  const label = (t.slots as Record<string, string>)[slotLabel] ?? slotLabel;
  const statusLabel = (s: string) => (t.docStatus as Record<string, string>)[s] ?? s;

  return (
    <div className="pad stack tight">
      <div className="row">
        <strong style={{ fontSize: 14 }}>{label}</strong>
        <span className="spacer" style={{ flex: 1 }} />
        {latest ? (
          <span className={`pill ${tone(latest.status)}`}>
            {statusLabel(latest.status)} · v{latest.version}
          </span>
        ) : (
          <span className="pill plain">{t.common.notUploaded}</span>
        )}
      </div>

      {latest?.rejectionNote && (
        <div className="notice bad">
          {t.researcher.sentBackLabel}: {latest.rejectionNote}
        </div>
      )}

      {history.length > 0 && (
        <ul style={{ margin: 0, paddingInlineStart: 0, listStyle: "none" }}>
          {history.map((h) => (
            <li key={h.id} className="small dim mono" style={{ lineHeight: 1.8 }}>
              v{h.version} ·{" "}
              <a href={`/api/files/${h.storageKey}`} target="_blank" rel="noreferrer">
                {h.fileName}
              </a>{" "}
              · {statusLabel(h.status)}
            </li>
          ))}
        </ul>
      )}

      {state?.error && <div className="notice bad">{state.error}</div>}
      {state?.ok && <div className="notice ok">{state.ok}</div>}

      {!accepted && !locked && (
        <form action={action} className="row">
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="slotLabel" value={slotLabel} />
          <input
            type="file"
            name="file"
            accept="image/*,application/pdf"
            required
            aria-label={label}
            style={{ flex: "1 1 200px", minWidth: 0 }}
          />
          <button type="submit" className="btn sm primary" disabled={pending}>
            {pending
              ? t.common.uploading
              : latest
                ? t.researcher.uploadNewVersion
                : t.common.upload}
          </button>
        </form>
      )}
      {accepted && (
        <p className="small dim" style={{ margin: 0 }}>
          {t.researcher.acceptedNote}
        </p>
      )}
    </div>
  );
}

/** One submission on the company's side, with accept and reject. */
export function ReviewCard({ submission }: { submission: Submission }) {
  const t = useT();
  const [state, action, pending] = useActionState<UploadState, FormData>(
    reviewDocument,
    null,
  );
  const [rejecting, setRejecting] = useState(false);
  const settled = submission.status !== "pending";
  const label =
    (t.slots as Record<string, string>)[submission.slotLabel] ?? submission.slotLabel;
  const statusLabel =
    (t.docStatus as Record<string, string>)[submission.status] ?? submission.status;

  return (
    <div className="pad stack tight">
      <div className="row">
        <strong style={{ fontSize: 14 }}>{label}</strong>
        <span style={{ flex: 1 }} />
        <span className={`pill ${tone(submission.status)}`}>
          {statusLabel} · v{submission.version}
        </span>
      </div>

      <p className="small dim mono" style={{ margin: 0 }}>
        <a href={`/api/files/${submission.storageKey}`} target="_blank" rel="noreferrer">
          {submission.fileName}
        </a>{" "}
        · {t.client.uploaded} {submission.uploadedAt}
      </p>

      {submission.rejectionNote && (
        <div className="notice bad">
          {t.client.yourNote}: {submission.rejectionNote}
        </div>
      )}

      {state?.error && <div className="notice bad">{state.error}</div>}
      {state?.ok && <div className="notice ok">{state.ok}</div>}

      {!settled && !rejecting && (
        <form action={action} className="row">
          <input type="hidden" name="submissionId" value={submission.id} />
          <input type="hidden" name="decision" value="accept" />
          <button type="submit" className="btn ok sm" disabled={pending}>
            {t.common.accept}
          </button>
          <button
            type="button"
            className="btn danger sm"
            onClick={() => setRejecting(true)}
          >
            {t.common.reject}
          </button>
        </form>
      )}

      {!settled && rejecting && (
        <form action={action} className="stack tight">
          <input type="hidden" name="submissionId" value={submission.id} />
          <input type="hidden" name="decision" value="reject" />
          <div className="field">
            <label htmlFor={`note-${submission.id}`}>{t.client.whatNeedsFixing}</label>
            <textarea
              id={`note-${submission.id}`}
              name="note"
              required
              placeholder={t.client.fixPlaceholder}
            />
            <span className="hint">{t.client.fixHint}</span>
          </div>
          <div className="row">
            <button type="submit" className="btn danger sm" disabled={pending}>
              {pending ? t.common.sending : t.client.sendItBack}
            </button>
            <button type="button" className="btn sm" onClick={() => setRejecting(false)}>
              {t.common.cancel}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
