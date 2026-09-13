import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { AvailabilityToggle } from "@/components/Interactions";
import LocationPinger from "@/components/LocationPinger";
import { PageHead, StatusPill } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function ResearcherHome() {
  const user = await requireRole("researcher");
  const t = await getT();
  const available = Boolean(user.researcherProfile?.isAvailable);

  const [open, done] = await Promise.all([
    db.task.findMany({
      where: {
        assignedResearcherId: user.id,
        status: { notIn: ["completed", "cancelled"] },
      },
      include: {
        documents: { where: { status: "rejected" }, select: { id: true } },
        _count: { select: { photos: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.task.count({ where: { assignedResearcherId: user.id, status: "completed" } }),
  ]);

  return (
    <>
      <PageHead title={`${t.researcher.hello}, ${user.fullName.split(" ")[0]}`}>
        {t.researcher.offersArrive}
      </PageHead>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="pad stack tight">
          <div className="row">
            <AvailabilityToggle initial={available} />
            <span style={{ flex: 1 }} />
            <span className="pill plain">{done} {t.researcher.completed}</span>
          </div>
          <LocationPinger enabled={available} />
        </div>
      </div>

      <div className="card">
        <header>
          <h3>{t.researcher.yourTasks}</h3>
          <span className="spacer" />
          <span className="pill plain">{open.length}</span>
        </header>
        <div className="rows">
          {open.length === 0 && (
            <div className="empty">
              {t.researcher.nothingOn}
            </div>
          )}
          {open.map((t2) => (
            <Link key={t2.id} href={`/researcher/tasks/${t2.id}`} className="rowitem">
              <span className="main">
                <strong>
                  {t2.reference} · {t2.title}
                </strong>
                <span>{t2.addressText}</span>
                <span className="mono" style={{ fontSize: 11 }}>
                  {t2._count.photos} {t.researcher.photosTaken}
                </span>
              </span>
              <span className="side">
                {t2.documents.length > 0 && (
                  <span className="pill bad">
                    {t2.documents.length} {t.researcher.sentBack}
                  </span>
                )}
                <StatusPill status={t2.status} />
                <span className="small dim">{timeAgo(t2.createdAt, t)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
