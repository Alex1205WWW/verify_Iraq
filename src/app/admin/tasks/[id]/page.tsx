import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import MapCanvas from "@/components/MapCanvas";
import { ForceCloseButton, OfferButton, SimulateReply } from "@/components/Interactions";
import { DocPill, Expertise, OfferPill, PageHead, StatusPill } from "@/components/ui";
import { getT } from "@/lib/prefs";
import { whatsappConfigured } from "@/lib/whatsapp";
import { EXPERTISE } from "@/lib/types";
import {
  clockTime,
  coords,
  distanceMetres,
  fullStamp,
  prettyDistance,
  timeAgo,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminTaskDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ skill?: string }>;
}) {
  await requireRole("admin");
  const t = await getT();
  const { id } = await params;
  const { skill = "" } = await searchParams;

  const task = await db.task.findUnique({
    where: { id },
    include: {
      client: { include: { clientProfile: true } },
      assignedResearcher: { include: { researcherProfile: true } },
      attachments: true,
      photos: { orderBy: { serverTime: "asc" } },
      documents: { orderBy: [{ slotLabel: "asc" }, { version: "desc" }] },
      messages: { include: { sender: true }, orderBy: { createdAt: "asc" } },
      blocked: { include: { sender: true }, orderBy: { createdAt: "desc" } },
      offers: { include: { researcher: true }, orderBy: { sentAt: "desc" } },
    },
  });

  if (!task) notFound();

  const assignable = task.status === "pending_assignment" || task.status === "offered";

  const candidates = assignable
    ? await db.user.findMany({
        where: { role: "researcher", status: "approved" },
        include: { researcherProfile: true },
        orderBy: { fullName: "asc" },
      })
    : [];

  const shortlist = candidates.filter((c) => {
    if (!c.researcherProfile?.isAvailable) return false;
    if (skill && !c.researcherProfile.expertise.split(",").includes(skill)) return false;
    // Do not offer the same task twice to the same person.
    return !task.offers.some((o) => o.researcherId === c.id);
  });

  const pendingOffer = task.offers.find((o) => o.response === "pending");
  const dryRun = !whatsappConfigured();

  return (
    <>
      <PageHead title={`${task.reference} · ${task.title}`}>
        {task.addressText}
      </PageHead>

      <div className="row" style={{ marginBottom: 14 }}>
        <StatusPill status={task.status} />
        <span className="small dim">{fullStamp(task.createdAt)}</span>
        <span style={{ flex: 1 }} />
        <Link href="/admin/tasks" className="btn sm">
          {t.common.back}
        </Link>
      </div>

      <div className="grid detail-split">
        <div className="stack">
          {/* ------------------------------------------------ assignment */}
          {assignable && (
            <div className="card">
              <header>
                <h3>{t.admin.assignTitle}</h3>
                <span className="spacer" />
                {dryRun && <span className="pill warn">{t.admin.dryRunPill}</span>}
              </header>

              {dryRun && (
                <div className="pad">
                  <div className="notice warn">
                    {t.admin.dryRunNote}
                  </div>
                </div>
              )}

              <form className="pad row">
                <div className="field" style={{ flex: "1 1 220px" }}>
                  <label htmlFor="skill">{t.admin.filterExpertise}</label>
                  <select id="skill" name="skill" defaultValue={skill}>
                    <option value="">{t.common.any}</option>
                    {EXPERTISE.map((e) => (
                      <option key={e} value={e}>
                        {(t.expertise as Record<string, string>)[e] ?? e}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn" type="submit" style={{ alignSelf: "flex-end" }}>
                  {t.common.apply}
                </button>
              </form>

              <div className="rows">
                {shortlist.length === 0 && (
                  <div className="empty">
                    {t.admin.nobodyAvailable}
                  </div>
                )}
                {shortlist.map((c) => {
                  const p = c.researcherProfile!;
                  const away =
                    p.lastLat && p.lastLng
                      ? distanceMetres(task.lat, task.lng, p.lastLat, p.lastLng)
                      : null;
                  return (
                    <div key={c.id} className="rowitem">
                      <span className="main">
                        <strong>{c.fullName}</strong>
                        <span>
                          {p.city}, {p.country}
                          {away !== null && ` · ${prettyDistance(away)} ${t.admin.fromSite}`}
                        </span>
                        <span className="mono" style={{ fontSize: 11 }}>
                          {p.whatsappNumber} · <Expertise value={p.expertise} />
                        </span>
                      </span>
                      <span className="side">
                        <OfferButton
                          taskId={task.id}
                          researcherId={c.id}
                          disabled={Boolean(pendingOffer)}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>

              {pendingOffer && (
                <div className="pad">
                  <p className="small dim" style={{ margin: 0 }}>
                    {t.admin.offerOutTo} {pendingOffer.researcher.fullName}.{" "}
                    {t.admin.offerOutRest}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------------- offer history */}
          {task.offers.length > 0 && (
            <div className="card">
              <header>
                <h3>{t.admin.offerHistory}</h3>
                <span className="spacer" />
                <span className="pill plain">{task.offers.length}</span>
              </header>
              <div className="rows">
                {task.offers.map((o) => (
                  <div key={o.id} className="rowitem">
                    <span className="main">
                      <strong>{o.researcher.fullName}</strong>
                      <span>
                        {t.admin.sent} {fullStamp(o.sentAt)}
                        {o.respondedAt &&
                          ` · ${t.admin.answered} ${timeAgo(o.respondedAt, t)}`}
                      </span>
                      {o.dryRun && (
                        <span className="mono" style={{ fontSize: 11 }}>
                          {t.admin.dryRun} · {o.waMessageId}
                        </span>
                      )}
                    </span>
                    <span className="side">
                      <OfferPill response={o.response} />
                      {o.response === "pending" && <SimulateReply offerId={o.id} />}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- photos */}
          <div className="card">
            <header>
              <h3>{t.admin.sitePhotos}</h3>
              <span className="spacer" />
              <span className="pill plain">{task.photos.length}</span>
            </header>
            <div className="pad">
              {task.photos.length === 0 ? (
                <p className="small dim" style={{ margin: 0 }}>
                  {t.admin.noneCaptured}
                </p>
              ) : (
                <div className="photogrid">
                  {task.photos.map((p) => {
                    const away = distanceMetres(task.lat, task.lng, p.lat, p.lng);
                    return (
                      <figure key={p.id} className="photo" style={{ margin: 0 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/files/${p.storageKey}`} alt={`${p.photoType} photo`} />
                        <figcaption className="meta">
                          <b>{p.photoType}</b>
                          <br />
                          {coords(p.lat, p.lng)} ±{Math.round(p.accuracyM)}m
                          <br />
                          server {fullStamp(p.serverTime)}
                          <br />
                          <span style={{ color: away > 250 ? "var(--bad)" : "inherit" }}>
                            {prettyDistance(away)} {t.admin.fromPin}
                          </span>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------------------------- documents */}
          <div className="card">
            <header>
              <h3>{t.client.documentsLabel}</h3>
              <span className="spacer" />
              <span className="pill plain">{task.documents.length}</span>
            </header>
            <div className="rows">
              {task.documents.length === 0 && (
                <div className="empty">{t.admin.nothingSubmitted}</div>
              )}
              {task.documents.map((d) => (
                <div key={d.id} className="rowitem">
                  <span className="main">
                    <strong>
                      {d.slotLabel} · v{d.version}
                    </strong>
                    <span>
                      <a href={`/api/files/${d.storageKey}`} target="_blank" rel="noreferrer">
                        {d.fileName}
                      </a>
                      {d.rejectionNote && ` · "${d.rejectionNote}"`}
                    </span>
                  </span>
                  <span className="side">
                    <DocPill status={d.status} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------ chat */}
          <div className="card">
            <header>
              <h3>{t.admin.transcript}</h3>
              <span className="spacer" />
              <span className="pill plain">{t.common.readOnly}</span>
            </header>
            {task.messages.length === 0 ? (
              <div className="empty">{t.admin.nothingSaid}</div>
            ) : (
              <div className="chatlog">
                {task.messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.isSystem ? "system" : ""}`}>
                    {!m.isSystem && <span className="who">{m.sender.fullName}</span>}
                    {m.body}
                    <span className="who" style={{ marginTop: 3 }}>
                      {clockTime(m.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="pad">
              <p className="small dim" style={{ margin: 0 }}>
                {t.admin.transcriptNote}
              </p>
            </div>
          </div>

          {/* ------------------------------------------- blocked attempts */}
          {task.blocked.length > 0 && (
            <div className="card">
              <header>
                <h3>{t.admin.blockedTitle}</h3>
                <span className="spacer" />
                <span className="pill bad">{task.blocked.length}</span>
              </header>
              <div className="rows">
                {task.blocked.map((b) => (
                  <div key={b.id} className="rowitem">
                    <span className="main">
                      <strong>{b.sender.fullName}</strong>
                      <span className="mono" style={{ fontSize: 11 }}>
                        {b.originalBody}
                      </span>
                    </span>
                    <span className="side">
                      <span className="pill bad">{b.matchedRule}</span>
                      <span className="small dim">{timeAgo(b.createdAt, t)}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="pad">
                <p className="small dim" style={{ margin: 0 }}>
                  {t.admin.blockedNote}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------ sidebar */}
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
                    lines: [fullStamp(p.serverTime)],
                  })),
                ]}
              />
              <p className="small dim mono" style={{ marginTop: 8 }}>
                {coords(task.lat, task.lng)}
              </p>
            </div>
          </div>

          <div className="card">
            <header>
              <h3>{t.admin.company}</h3>
            </header>
            <div className="pad">
              <dl className="kv">
                <dt>{t.admin.company}</dt>
                <dd>{task.client.clientProfile?.companyName ?? "—"}</dd>
                <dt>{t.admin.contact}</dt>
                <dd>{task.client.fullName}</dd>
                <dt>{t.auth.email}</dt>
                <dd>{task.client.email}</dd>
                <dt>{t.auth.phone}</dt>
                <dd>{task.client.phone}</dd>
              </dl>
            </div>
          </div>

          {task.assignedResearcher && (
            <div className="card">
              <header>
                <h3>{t.role.researcher}</h3>
              </header>
              <div className="pad">
                <dl className="kv">
                  <dt>{t.auth.yourName}</dt>
                  <dd>{task.assignedResearcher.fullName}</dd>
                  <dt>{t.auth.whatsapp}</dt>
                  <dd>{task.assignedResearcher.researcherProfile?.whatsappNumber}</dd>
                  <dt>{t.auth.email}</dt>
                  <dd>{task.assignedResearcher.email}</dd>
                  <dt>{t.admin.based}</dt>
                  <dd>
                    {task.assignedResearcher.researcherProfile?.city},{" "}
                    {task.assignedResearcher.researcherProfile?.country}
                  </dd>
                </dl>
              </div>
            </div>
          )}

          {task.attachments.length > 0 && (
            <div className="card">
              <header>
                <h3>{t.admin.filesFromCompany}</h3>
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

          <div className="card">
            <header>
              <h3>{t.admin.signOff}</h3>
            </header>
            <div className="pad stack tight">
              <dl className="kv">
                <dt>{t.admin.researcherSigned}</dt>
                <dd>
                  {task.researcherDoneAt ? fullStamp(task.researcherDoneAt) : t.admin.notYet}
                </dd>
                <dt>{t.admin.companySigned}</dt>
                <dd>{task.clientDoneAt ? fullStamp(task.clientDoneAt) : t.admin.notYet}</dd>
                <dt>{t.admin.closed}</dt>
                <dd>{task.closedAt ? fullStamp(task.closedAt) : t.admin.stillOpen}</dd>
              </dl>
              {task.status !== "completed" && <ForceCloseButton taskId={task.id} />}
              <p className="small dim" style={{ margin: 0 }}>
                {t.admin.forceCloseNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
