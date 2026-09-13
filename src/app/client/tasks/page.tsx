import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHead, StatusPill } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function MyTasks() {
  const user = await requireRole("client");
  const tr = await getT();

  const tasks = await db.task.findMany({
    where: { clientId: user.id },
    include: {
      _count: { select: { photos: true } },
      documents: { where: { status: "pending" }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHead
        title={tr.client.myTasksTitle}
        actions={
          <Link href="/client/new" className="btn primary sm">
            {tr.nav.fileTask}
          </Link>
        }
      >
        {tr.client.myTasksSub}
      </PageHead>

      <div className="card">
        <div className="rows">
          {tasks.length === 0 && (
            <div className="empty">
              {tr.client.nothingFiled}{" "}
              <Link href="/client/new">{tr.client.fileFirst}</Link>
            </div>
          )}
          {tasks.map((t) => (
            <Link key={t.id} href={`/client/tasks/${t.id}`} className="rowitem">
              <span className="main">
                <strong>
                  {t.reference} · {t.title}
                </strong>
                <span>{t.addressText}</span>
                <span className="mono" style={{ fontSize: 11 }}>
                  {t._count.photos} {tr.admin.photos}
                  {t.documents.length > 0 && ` · ${t.documents.length} ${tr.client.toReview}`}
                </span>
              </span>
              <span className="side">
                {t.documents.length > 0 && (
                  <span className="pill warn">{tr.client.needsReview}</span>
                )}
                <StatusPill status={t.status} />
                <span className="small dim">{timeAgo(t.createdAt, tr)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
