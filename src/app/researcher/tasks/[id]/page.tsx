import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import MapCanvas from "@/components/MapCanvas";
import ChatPanel from "@/components/ChatPanel";
import CameraCapture from "@/components/CameraCapture";
import { SlotUploader, type Submission } from "@/components/Documents";
import { CompleteButton, StartWorkButton } from "@/components/Interactions";
import { PageHead, StatusPill } from "@/components/ui";
import { DEFAULT_DOC_SLOTS } from "@/lib/types";
import { clockTime, coords, fullStamp } from "@/lib/format";
import { getT } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function ResearcherTaskDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("researcher");
  const t = await getT();
  const { id } = await params;

  const task = await db.task.findUnique({
    where: { id },
    include: {
      attachments: true,
      photos: { orderBy: { serverTime: "desc" } },
      documents: { orderBy: [{ slotLabel: "asc" }, { version: "desc" }] },
      messages: { include: { sender: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!task || task.assignedResearcherId !== user.id) notFound();

  const started = Boolean(task.startedAt);
  const finished = task.status === "completed";

  const slots = [
    ...new Set([...DEFAULT_DOC_SLOTS, ...task.documents.map((d) => d.slotLabel)]),
  ];
  const bySlot = new Map<string, Submission[]>();
  for (const d of task.documents) {
    const row: Submission = {
      id: d.id,
      slotLabel: d.slotLabel,
      version: d.version,
      fileName: d.fileName,
      storageKey: d.storageKey,
      status: d.status,
      rejectionNote: d.rejectionNote,
      uploadedAt: fullStamp(d.createdAt),
    };
    bySlot.set(d.slotLabel, [...(bySlot.get(d.slotLabel) ?? []), row]);
  }

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${task.lat},${task.lng}`;

  return (
    <>
      <PageHead title={`${task.reference} · ${task.title}`}>{task.addressText}</PageHead>

      <div className="row" style={{ marginBottom: 14 }}>
        <StatusPill status={task.status} />
        <span style={{ flex: 1 }} />
        <Link href="/researcher" className="btn sm">
          {t.common.back}
        </Link>
      </div>

      <div className="grid detail-split">
        <div className="stack">
          {!started && (
            <div className="card">
              <div className="pad stack tight">
                <div className="notice">
                  {t.researcher.startNote}
                </div>
                <StartWorkButton taskId={task.id} />
              </div>
            </div>
          )}

          {started && !finished && (
            <div className="card">
              <header>
                <h3>{t.admin.sitePhotos}</h3>
                <span className="spacer" />
                <span className="pill plain">{task.photos.length} {t.researcher.taken}</span>
              </header>
              <div className="pad">
                <CameraCapture taskId={task.id} />
              </div>
            </div>
          )}

          {task.photos.length > 0 && (
            <div className="card">
              <header>
                <h3>{t.researcher.takenSoFar}</h3>
              </header>
              <div className="pad">
                <div className="photogrid">
                  {task.photos.map((p) => (
                    <figure key={p.id} className="photo" style={{ margin: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${p.storageKey}`} alt={`${p.photoType} photo`} />
                      <figcaption className="meta">
                        <b>{p.photoType}</b>
                        <br />
                        {coords(p.lat, p.lng)}
                        <br />
                        {fullStamp(p.serverTime)}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <header>
              <h3>{t.researcher.formAndDocs}</h3>
              <span className="spacer" />
              <span className="pill plain">{t.researcher.fromGallery}</span>
            </header>
            <div className="rows">
              {slots.map((slot) => (
                <SlotUploader
                  key={slot}
                  taskId={task.id}
                  slotLabel={slot}
                  history={bySlot.get(slot) ?? []}
                  locked={finished}
                />
              ))}
            </div>
          </div>

          <ChatPanel
            taskId={task.id}
            meId={user.id}
            open={started}
            counterpartLabel={t.chat.company}
            lines={task.messages.map((m) => ({
              id: m.id,
              body: m.body,
              isSystem: m.isSystem,
              at: clockTime(m.createdAt),
              senderId: m.senderId,
              senderLabel: m.senderId === user.id ? t.chat.you : t.chat.company,
            }))}
          />
        </div>

        <div className="stack">
          <div className="card">
            <header>
              <h3>{t.researcher.whereToGo}</h3>
            </header>
            <div className="pad stack tight">
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
                ]}
              />
              <p className="small dim mono" style={{ margin: 0 }}>
                {coords(task.lat, task.lng)}
              </p>
              <a
                className="btn block"
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
              >
                {t.researcher.openInMaps}
              </a>
            </div>
          </div>

          {task.description && (
            <div className="card">
              <header>
                <h3>{t.researcher.whatToDo}</h3>
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
                <h3>{t.researcher.filesToTake}</h3>
              </header>
              <div className="rows">
                {task.attachments.map((a) => (
                  <div key={a.id} className="rowitem">
                    <span className="main">
                      <a href={`/api/files/${a.storageKey}`} target="_blank" rel="noreferrer">
                        {a.fileName}
                      </a>
                      <span className="mono" style={{ fontSize: 11 }}>
                        {Math.round(a.sizeBytes / 1024)} KB
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {started && (
            <div className="card">
              <header>
                <h3>{t.client.finish}</h3>
              </header>
              <div className="pad stack tight">
                <CompleteButton
                  taskId={task.id}
                  alreadyDone={Boolean(task.researcherDoneAt)}
                />
                <p className="small dim" style={{ margin: 0 }}>
                  {t.researcher.companyMarks}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
