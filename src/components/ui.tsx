"use client";

import { useT } from "./Intl";
import type { TaskStatus } from "@/lib/types";
import { TASK_STATUS_TONE } from "@/lib/types";

// Client components so they can read the dictionary from context. They render
// fine inside server components — the labels are the only thing that needs the
// language, and it is already known before the first byte is sent.

export function StatusPill({ status }: { status: string }) {
  const t = useT();
  const key = status as TaskStatus;
  const label = (t.status as Record<string, string>)[key] ?? status;
  const tone = TASK_STATUS_TONE[key] ?? "plain";
  return <span className={`pill ${tone}`}>{label}</span>;
}

export function DocPill({ status }: { status: string }) {
  const t = useT();
  const tone = status === "accepted" ? "ok" : status === "rejected" ? "bad" : "warn";
  const label = (t.docStatus as Record<string, string>)[status] ?? status;
  return <span className={`pill ${tone}`}>{label}</span>;
}

export function OfferPill({ response }: { response: string }) {
  const t = useT();
  const tone =
    response === "accepted" ? "ok" : response === "declined" ? "bad" : "warn";
  const label = (t.offerStatus as Record<string, string>)[response] ?? response;
  return <span className={`pill ${tone}`}>{label}</span>;
}

export function AvailabilityPill({ available }: { available: boolean }) {
  const t = useT();
  return (
    <span className={`pill ${available ? "ok" : "plain"}`}>
      {available ? t.availability.available : t.availability.unavailable}
    </span>
  );
}

/** Translates a stored English expertise value for display. */
export function Expertise({ value }: { value: string }) {
  const t = useT();
  const parts = value.split(",").filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <>{parts.map((p) => (t.expertise as Record<string, string>)[p] ?? p).join(" · ")}</>
  );
}

export function SlotLabel({ value }: { value: string }) {
  const t = useT();
  return <>{(t.slots as Record<string, string>)[value] ?? value}</>;
}

export function PageHead({
  title,
  children,
  actions,
}: {
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {actions}
      {children && <p>{children}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
