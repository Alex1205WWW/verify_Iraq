import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import MapCanvas, { type MapMarker } from "@/components/MapCanvas";
import { PageHead } from "@/components/ui";
import { EXPERTISE } from "@/lib/types";
import { getT } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function Coverage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  await requireRole("client");
  const t = await getT();
  const { skill = "" } = await searchParams;

  // Only what a company is allowed to know: that someone is there, roughly
  // where, and what they can do. No name, no number, no identifier that could
  // be used to reach them off the platform. This is enforced by what the query
  // selects, not by what the page chooses to render.
  const rows = await db.researcherProfile.findMany({
    where: {
      isAvailable: true,
      user: { status: "approved" },
      ...(skill ? { expertise: { contains: skill } } : {}),
    },
    select: {
      userId: true,
      city: true,
      country: true,
      expertise: true,
      lastLat: true,
      lastLng: true,
    },
  });

  const markers: MapMarker[] = rows
    .filter((r) => r.lastLat !== null && r.lastLng !== null)
    .map((r, i) => ({
      id: r.userId,
      lat: r.lastLat!,
      lng: r.lastLng!,
      tone: "ok",
      title: `${t.client.researcherWord} ${i + 1}`,
      lines: [
        `${r.city}, ${r.country}`,
        r.expertise
          .split(",")
          .filter(Boolean)
          .map((e) => (t.expertise as Record<string, string>)[e] ?? e)
          .join(" · "),
      ],
    }));

  const byCity = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.city}, ${r.country}`;
    byCity.set(key, (byCity.get(key) ?? 0) + 1);
  }

  return (
    <>
      <PageHead
        title={t.client.coverageTitle}
        actions={
          <Link href="/client/new" className="btn primary sm">
            {t.nav.fileTask}
          </Link>
        }
      >
        {t.client.coverageSub}
      </PageHead>

      <form className="card" style={{ marginBottom: 14 }}>
        <div className="pad row">
          <div className="field" style={{ flex: "1 1 240px" }}>
            <label htmlFor="skill">{t.client.whatYouNeed}</label>
            <select id="skill" name="skill" defaultValue={skill}>
              <option value="">{t.client.anything}</option>
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
        </div>
      </form>

      <div className="grid map-split">
        <MapCanvas markers={markers} className="mapbox tall" />

        <div className="card">
          <header>
            <h3>{t.client.availableNow}</h3>
            <span className="spacer" />
            <span className="pill ok">{rows.length}</span>
          </header>
          <div className="rows">
            {byCity.size === 0 && (
              <div className="empty">{t.client.nobodyAvailable}</div>
            )}
            {[...byCity.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([city, n]) => (
                <div key={city} className="rowitem">
                  <span className="main">
                    <strong>{city}</strong>
                  </span>
                  <span className="side">
                    <span className="pill ok">
                      {n} {n === 1 ? t.client.researcherWord : t.client.researchersWord}
                    </span>
                  </span>
                </div>
              ))}
          </div>
          <div className="pad">
            <p className="small dim" style={{ margin: 0 }}>
              {t.client.pinNote}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
