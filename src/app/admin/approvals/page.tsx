import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { decideApplication } from "@/actions/admin";
import { PageHead } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/prefs";
import { Expertise } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Approvals() {
  await requireRole("admin");
  const t = await getT();

  const pending = await db.user.findMany({
    where: { status: "pending" },
    include: { clientProfile: true, researcherProfile: true },
    orderBy: { createdAt: "asc" },
  });

  async function approve(formData: FormData) {
    "use server";
    await decideApplication(String(formData.get("userId")), true);
  }
  async function reject(formData: FormData) {
    "use server";
    await decideApplication(String(formData.get("userId")), false);
  }

  return (
    <>
      <PageHead title={t.admin.approvalsTitle}>{t.admin.approvalsSub}</PageHead>

      <div className="card">
        <div className="rows">
          {pending.length === 0 && (
            <div className="empty">{t.admin.noApplications}</div>
          )}
          {pending.map((u) => (
            <div key={u.id} className="rowitem">
              <span className="main">
                <strong>
                  {u.clientProfile?.companyName ?? u.fullName}
                  {u.clientProfile && ` · ${u.fullName}`}
                </strong>
                <span>
                  {u.email} · {u.phone}
                </span>
                <span className="mono" style={{ fontSize: 11 }}>
                  {u.role === "client"
                    ? `${t.role.client} · ${u.clientProfile?.city}, ${u.clientProfile?.country}`
                    : `${t.role.researcher} · ${u.researcherProfile?.city}, ${u.researcherProfile?.country}`}
                </span>
                {u.researcherProfile?.expertise && (
                  <span className="mono" style={{ fontSize: 11 }}>
                    <Expertise value={u.researcherProfile.expertise} />
                  </span>
                )}
                {u.researcherProfile?.coverageNote && (
                  <span>{u.researcherProfile.coverageNote}</span>
                )}
              </span>
              <span className="side">
                <span className="small dim">{timeAgo(u.createdAt, t)}</span>
                <form action={approve}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button className="btn ok sm" type="submit">
                    {t.common.approve}
                  </button>
                </form>
                <form action={reject}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button className="btn danger sm" type="submit">
                    {t.common.reject}
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
