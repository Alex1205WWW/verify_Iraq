"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessage, type ChatState } from "@/actions/chat";
import { useT } from "./Intl";

export type ChatLine = {
  id: string;
  body: string;
  isSystem: boolean;
  /** Formatted on the server. Formatting a date on both sides is the classic
      hydration mismatch: Node and the browser disagree on locale and zone. */
  at: string;
  senderId: string;
  senderLabel: string;
};

export default function ChatPanel({
  taskId,
  lines,
  meId,
  open,
  counterpartLabel,
}: {
  taskId: string;
  lines: ChatLine[];
  meId: string;
  open: boolean;
  counterpartLabel: string;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<ChatState, FormData>(
    sendMessage,
    null,
  );
  const logRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines.length]);

  useEffect(() => {
    if (state?.sent) formRef.current?.reset();
  }, [state]);

  return (
    <div className="card">
      <header>
        <h3>{t.chat.title}</h3>
        <span className="spacer" />
        <span className="pill plain">{counterpartLabel}</span>
      </header>

      {!open ? (
        <div className="empty">{t.chat.opensLater}</div>
      ) : (
        <>
          <div className="chatlog" ref={logRef}>
            {lines.length === 0 && (
              <p className="small dim" style={{ textAlign: "center", margin: 0 }}>
                {t.chat.noMessages}
              </p>
            )}
            {lines.map((line) => (
              <div
                key={line.id}
                className={`bubble ${
                  line.isSystem ? "system" : line.senderId === meId ? "mine" : ""
                }`}
              >
                {!line.isSystem && <span className="who">{line.senderLabel}</span>}
                {line.body}
                <span className="who" style={{ marginTop: 3, marginBottom: 0 }}>
                  {line.at}
                </span>
              </div>
            ))}
          </div>

          {state?.error && (
            <div className="notice bad" style={{ margin: "0 14px" }}>
              {state.error}
            </div>
          )}

          <form action={action} className="chatform" ref={formRef}>
            <input type="hidden" name="taskId" value={taskId} />
            <input
              name="body"
              type="text"
              placeholder={t.chat.placeholder}
              autoComplete="off"
              aria-label={t.chat.placeholder}
            />
            <button type="submit" className="btn primary" disabled={pending}>
              {t.common.send}
            </button>
          </form>

          <p className="small dim" style={{ padding: "0 14px 12px", margin: 0 }}>
            {t.chat.filterNote}
          </p>
        </>
      )}
    </div>
  );
}
