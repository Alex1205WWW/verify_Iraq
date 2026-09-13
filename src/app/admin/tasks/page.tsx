import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHead, StatusPill } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/prefs";

export const dynamic = "force-dynamic";

// Assignment is the operator's job, so the queue is sorted by what needs him
// rather than by date: unassigned first, then offers waiting on an answer.
const ORDER: Record<string, number> = {
  pending_assignment: 0,
  offered: 1,
  assigned: 2,
  in_progress: 3,
  under_review: 4,
  completed: 5,
  cancelled: 6,
};

export default async function TaskQueue({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("admin");
  const tr = await getT();
  const { status = "open" } = await searchParams;

  const where =
    status === "all"
      ? {}
      : status === "open"
        ? { status: { notIn: ["completed", "cancelled"] } }
        : { status };

  const tasks = await db.task.findMany({
    where,
    include: {
      client: { include: { clientProfile: true } },
      assignedResearcher: true,
      _count: { select: { photos: true, documents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  tasks.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  const tabs = [
    { key: "open", label: tr.admin.tabOpen },
    { key: "pending_assignment", label: tr.admin.tabNeedsAssignment },
    { key: "under_review", label: tr.admin.tabUnderReview },
    { key: "completed", label: tr.admin.tabCompleted },
    { key: "all", label: tr.admin.tabAll },
  ];

  return (
    <>
      <PageHead title={tr.admin.tasksTitle}>{tr.admin.tasksSub}</PageHead>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/tasks?status=${t.key}`}
            aria-current={status === t.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="rows">
          {tasks.length === 0 && <div className="empty">{tr.admin.noTasks}</div>}
          {tasks.map((t) => (
            <Link key={t.id} href={`/admin/tasks/${t.id}`} className="rowitem">
              <span className="main">
                <strong>
                  {t.reference} · {t.title}
                </strong>
                <span>
                  {t.addressText} · {tr.admin.filedBy}{" "}
                  {t.client.clientProfile?.companyName ?? t.client.fullName}
                </span>
                <span className="mono" style={{ fontSize: 11 }}>
                  {t.assignedResearcher
                    ? `${tr.admin.researcherIs}: ${t.assignedResearcher.fullName}`
                    : tr.admin.noResearcherYet}
                  {" · "}
                  {t._count.photos} {tr.admin.photos} · {t._count.documents}{" "}
                  {tr.admin.documents}
                </span>
              </span>
              <span className="side">
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
