import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import MapCanvas from "@/components/MapCanvas";
import ChatPanel from "@/components/ChatPanel";
import { ReviewCard } from "@/components/Documents";
import { CompleteButton } from "@/components/Interactions";
import { PageHead, SlotLabel, StatusPill } from "@/components/ui";
import { DEFAULT_DOC_SLOTS } from "@/lib/types";
import { clockTime, coords, distanceMetres, fullStamp, prettyDistance } from "@/lib/format";
import { getT } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function ClientTaskDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("client");
  const t = await getT();
  const { id } = await params;

  const task = await db.task.findUnique({
    where: { id },
    include: {
      attachments: true,
      photos: { orderBy: { serverTime: "asc" } },
      documents: { orderBy: [{ slotLabel: "asc" }, { version: "desc" }] },
      messages: { include: { sender: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!task || task.clientId !== user.id) notFound();

  const exterior = task.photos.filter((p) => p.photoType === "exterior");
  const interior = task.photos.filter((p) => p.photoType === "interior");

  // Latest version of each slot is what the company reviews.
  const latestBySlot = new Map<string, (typeof task.documents)[number]>();
  for (const d of task.documents) {
    if (!latestBySlot.has(d.slotLabel)) latestBySlot.set(d.slotLabel, d);
  }
  const slots = [
    ...new Set([...DEFAULT_DOC_SLOTS, ...task.documents.map((d) => d.slotLabel)]),
  ];

  return (
    <>
      <PageHead title={`${task.reference} · ${task.title}`}>{task.addressText}</PageHead>

      <div className="row" style={{ marginBottom: 14 }}>
        <StatusPill status={task.status} />
        {task.assignedResearcherId && (
          <span className="pill plain">{t.client.researcherAssigned}</span>
        )}
        <span style={{ flex: 1 }} />
        <Link href="/client/tasks" className="btn sm">
          {t.common.back}
        </Link>
      </div>

      <div className="grid detail-split">
        <div className="stack">
          <div className="card">
            <header>
              <h3>{t.client.photosLabel}</h3>
              <span className="spacer" />
              <span className="pill plain">{task.photos.length}</span>
            </header>
            <div className="pad stack">
              {task.photos.length === 0 && (
                <p className="small dim" style={{ margin: 0 }}>
                  {t.client.noPhotosYet}
                </p>
              )}

              {[
                { label: t.client.outside, set: exterior },
                { label: t.client.inside, set: interior },
              ].map(
                (group) =>
                  group.set.length > 0 && (
                    <div key={group.label}>
                      <p className="eyebrow">{group.label}</p>
                      <div className="photogrid">
                        {group.set.map((p) => {
                          const away = distanceMetres(task.lat, task.lng, p.lat, p.lng);
                          const far = away > 250;
                          return (
                            <figure key={p.id} className="photo" style={{ margin: 0 }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/files/${p.storageKey}`}
                                alt={`${p.photoType} photo of the site`}
                              />
                              <figcaption className="meta">
                                <b>{fullStamp(p.serverTime)}</b>
                                <br />
                                {coords(p.lat, p.lng)} ±{Math.round(p.accuracyM)}m
                                <br />
                                <span style={{ color: far ? "var(--bad)" : "inherit" }}>
                                  {prettyDistance(away)} {t.client.fromAddress}
                                  {far && ` — ${t.client.worthQuerying}`}
                                </span>
                              </figcaption>
                            </figure>
                          );
                        })}
                      </div>
                    </div>
                  ),
              )}

              {task.photos.length > 0 && (
                <p className="small dim" style={{ margin: 0 }}>
                  {t.client.photoNote}
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <header>
              <h3>{t.client.documentsLabel}</h3>
              <span className="spacer" />
              <span className="pill plain">{slots.length} {t.client.required}</span>
            </header>
            <div className="rows">
              {slots.map((slot) => {
                const latest = latestBySlot.get(slot);
                if (!latest) {
                  return (
                    <div key={slot} className="pad row">
                      <strong style={{ fontSize: 14 }}>
                        <SlotLabel value={slot} />
                      </strong>
                      <span style={{ flex: 1 }} />
                      <span className="pill plain">{t.common.notUploaded}</span>
                    </div>
                  );
                }
                return (
                  <ReviewCard
                    key={latest.id}
                    submission={{
                      id: latest.id,
                      slotLabel: latest.slotLabel,
                      version: latest.version,
                      fileName: latest.fileName,
                      storageKey: latest.storageKey,
                      status: latest.status,
                      rejectionNote: latest.rejectionNote,
                      uploadedAt: fullStamp(latest.createdAt),
                    }}
                  />
                );
              })}
            </div>
          </div>

          <ChatPanel
            taskId={task.id}
            meId={user.id}
            open={Boolean(task.startedAt)}
            counterpartLabel={t.chat.researcher}
            lines={task.messages.map((m) => ({
              id: m.id,
              body: m.body,
              isSystem: m.isSystem,
              at: clockTime(m.createdAt),
              senderId: m.senderId,
              senderLabel: m.senderId === user.id ? t.chat.you : t.chat.researcher,
            }))}
          />
        </div>

        <div className="stack">
          <div className="card">
            <header>
              <h3>{t.admin.location}</h3>
            </header>
            <div className="pad">
              <MapCanvas
                markers={[
                  {
                    id: "site",
                    lat: task.lat,
                    lng: task.lng,
                    tone: "wait",
                    title: task.reference,
                    lines: [task.addressText],
                  },
                  ...task.photos.map((p) => ({
                    id: p.id,
                    lat: p.lat,
                    lng: p.lng,
                    tone: "ok" as const,
                    title: `${p.photoType} photo`,
                  })),
                ]}
              />
              <p className="small dim mono" style={{ marginTop: 8 }}>
                {coords(task.lat, task.lng)}
              </p>
            </div>
          </div>

          {task.description && (
            <div className="card">
              <header>
                <h3>{t.client.brief}</h3>
              </header>
              <div className="pad">
                <p className="small" style={{ margin: 0 }}>
                  {task.description}
                </p>
              </div>
            </div>
          )}

          {task.attachments.length > 0 && (
            <div className="card">
              <header>
                <h3>{t.client.filesYouSent}</h3>
              </header>
              <div className="rows">
                {task.attachments.map((a) => (
                  <div key={a.id} className="rowitem">
                    <span className="main">
                      <a href={`/api/files/${a.storageKey}`} target="_blank" rel="noreferrer">
                        {a.fileName}
                      </a>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <header>
              <h3>{t.client.finish}</h3>
            </header>
            <div className="pad stack tight">
              <p className="small dim" style={{ margin: 0 }}>
                {t.client.bothSides}
              </p>
              <CompleteButton
                taskId={task.id}
                alreadyDone={Boolean(task.clientDoneAt)}
              />
              {task.researcherDoneAt && (
                <p className="small dim" style={{ margin: 0 }}>
                  {t.client.researcherMarked} {fullStamp(task.researcherDoneAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
