import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import MapCanvas, { type MapMarker } from "@/components/MapCanvas";
import { PageHead, StatusPill, AvailabilityPill } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { EXPERTISE } from "@/lib/types";
import { getT } from "@/lib/prefs";
import { Expertise } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DispatchMap({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; only?: string }>;
}) {
  await requireRole("admin");
  const t = await getT();
  const { skill = "", only = "" } = await searchParams;

  const [researchers, tasks] = await Promise.all([
    db.user.findMany({
      where: { role: "researcher", status: "approved" },
      include: { researcherProfile: true },
      orderBy: { fullName: "asc" },
    }),
    db.task.findMany({
      where: { status: { notIn: ["completed", "cancelled"] } },
      include: { client: { include: { clientProfile: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const filtered = researchers.filter((r) => {
    if (!r.researcherProfile) return false;
    if (skill && !r.researcherProfile.expertise.split(",").includes(skill)) return false;
    if (only === "available" && !r.researcherProfile.isAvailable) return false;
    return true;
  });

  const markers: MapMarker[] = [];

  for (const tk of tasks) {
    markers.push({
      id: `t-${tk.id}`,
      lat: tk.lat,
      lng: tk.lng,
      tone:
        tk.status === "pending_assignment"
          ? "wait"
          : tk.status === "offered"
            ? "warn"
            : "info",
      title: `${tk.reference} · ${tk.title}`,
      lines: [tk.addressText, tk.client.clientProfile?.companyName ?? tk.client.fullName],
      href: `/admin/tasks/${tk.id}`,
    });
  }

  for (const r of filtered) {
    const p = r.researcherProfile;
    if (!p?.lastLat || !p?.lastLng) continue;
    markers.push({
      id: `r-${r.id}`,
      lat: p.lastLat,
      lng: p.lastLng,
      tone: p.isAvailable ? "ok" : "plain",
      title: r.fullName,
      lines: [
        `${p.city}, ${p.country}`,
        p.whatsappNumber,
        `${t.admin.seen} ${timeAgo(p.lastSeenAt, t)}`,
      ],
    });
  }

  const withoutPin = filtered.filter(
    (r) => !r.researcherProfile?.lastLat || !r.researcherProfile?.lastLng,
  ).length;

  return (
    <>
      <PageHead title={t.admin.mapTitle}>{t.admin.mapSub}</PageHead>

      <form className="card" style={{ marginBottom: 14 }}>
        <div className="pad row">
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="skill">{t.admin.expertiseLabel}</label>
            <select id="skill" name="skill" defaultValue={skill}>
              <option value="">{t.common.any}</option>
              {EXPERTISE.map((e) => (
                <option key={e} value={e}>
                  {(t.expertise as Record<string, string>)[e] ?? e}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "1 1 180px" }}>
            <label htmlFor="only">{t.admin.availabilityLabel}</label>
            <select id="only" name="only" defaultValue={only}>
              <option value="">{t.common.everyone}</option>
              <option value="available">{t.admin.availableOnly}</option>
            </select>
          </div>
          <button type="submit" className="btn" style={{ alignSelf: "flex-end" }}>
            {t.common.apply}
          </button>
        </div>
      </form>

      <div className="grid map-split">
        <MapCanvas markers={markers} className="mapbox tall" />

        <div className="card">
          <header>
            <h3>{t.admin.researchers}</h3>
            <span className="spacer" />
            <span className="pill plain">{filtered.length}</span>
          </header>
          <div className="rows">
            {filtered.length === 0 && (
              <div className="empty">{t.admin.noMatch}</div>
            )}
            {filtered.map((r) => {
              const p = r.researcherProfile!;
              return (
                <div key={r.id} className="rowitem">
                  <span className="main">
                    <strong>{r.fullName}</strong>
                    <span>
                      {p.city}, {p.country} · {p.whatsappNumber}
                    </span>
                    <span className="mono" style={{ fontSize: 11 }}>
                      {p.expertise ? <Expertise value={p.expertise} /> : t.admin.noExpertise}
                    </span>
                  </span>
                  <span className="side">
                    <AvailabilityPill available={p.isAvailable} />
                    <span className="small dim">{timeAgo(p.lastSeenAt, t)}</span>
                  </span>
                </div>
              );
            })}
          </div>
          {withoutPin > 0 && (
            <div className="pad">
              <p className="small dim" style={{ margin: 0 }}>
                {withoutPin} {t.admin.withoutPinNote}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <header>
          <h3>{t.admin.openTasks}</h3>
          <span className="spacer" />
          <Link href="/admin/tasks" className="btn sm">
            {t.admin.allTasks}
          </Link>
        </header>
        <div className="rows">
          {tasks.length === 0 && <div className="empty">{t.admin.nothingOpen}</div>}
          {tasks.slice(0, 6).map((tk) => (
            <Link key={tk.id} href={`/admin/tasks/${tk.id}`} className="rowitem">
              <span className="main">
                <strong>
                  {tk.reference} · {tk.title}
                </strong>
                <span>
                  {tk.addressText} · {tk.client.clientProfile?.companyName}
                </span>
              </span>
              <span className="side">
                <StatusPill status={tk.status} />
                <span className="small dim">{timeAgo(tk.createdAt, t)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
