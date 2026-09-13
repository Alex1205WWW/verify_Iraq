import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { setUserSuspended } from "@/actions/admin";
import { AvailabilityPill, PageHead } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function People({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  await requireRole("admin");
  const t = await getT();
  const { role = "researcher" } = await searchParams;

  const people = await db.user.findMany({
    where: { role: role === "client" ? "client" : "researcher" },
    include: {
      clientProfile: true,
      researcherProfile: true,
      _count: { select: { offers: true, tasksAssigned: true, tasksFiled: true } },
    },
    orderBy: { fullName: "asc" },
  });

  const declineCounts = await db.taskOffer.groupBy({
    by: ["researcherId"],
    where: { response: "declined" },
    _count: { _all: true },
  });
  const declines = new Map(declineCounts.map((d) => [d.researcherId, d._count._all]));

  async function toggle(formData: FormData) {
    "use server";
    await setUserSuspended(
      String(formData.get("userId")),
      String(formData.get("next")) === "suspend",
    );
  }

  return (
    <>
      <PageHead title={t.admin.peopleTitle}>{t.admin.peopleSub}</PageHead>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <Link
          href="/admin/people?role=researcher"
          aria-current={role !== "client" ? "page" : undefined}
        >
          {t.admin.tabResearchers}
        </Link>
        <Link
          href="/admin/people?role=client"
          aria-current={role === "client" ? "page" : undefined}
        >
          {t.admin.tabCompanies}
        </Link>
      </div>

      <div className="card">
        <div className="rows">
          {people.length === 0 && <div className="empty">{t.admin.nobodyHere}</div>}
          {people.map((u) => (
            <div key={u.id} className="rowitem">
              <span className="main">
                <strong>{u.clientProfile?.companyName ?? u.fullName}</strong>
                <span>
                  {u.email} · {u.phone}
                </span>
                <span className="mono" style={{ fontSize: 11 }}>
                  {u.role === "researcher"
                    ? `${u.researcherProfile?.city}, ${u.researcherProfile?.country} · ${u._count.tasksAssigned} ${t.admin.assigned} · ${declines.get(u.id) ?? 0} ${t.admin.declined} · ${t.admin.seen} ${timeAgo(u.researcherProfile?.lastSeenAt, t)}`
                    : `${u.clientProfile?.city}, ${u.clientProfile?.country} · ${u._count.tasksFiled} ${t.admin.tasksFiled}`}
                </span>
              </span>
              <span className="side">
                {u.role === "researcher" && (
                  <AvailabilityPill
                    available={Boolean(u.researcherProfile?.isAvailable)}
                  />
                )}
                <span className={`pill ${u.status === "approved" ? "ok" : "bad"}`}>
                  {u.status === "approved" ? t.admin.active : t.admin.suspended}
                </span>
                <form action={toggle}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input
                    type="hidden"
                    name="next"
                    value={u.status === "approved" ? "suspend" : "restore"}
                  />
                  <button className="btn sm" type="submit">
                    {u.status === "approved" ? t.admin.suspend : t.admin.restore}
                  </button>
                </form>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
