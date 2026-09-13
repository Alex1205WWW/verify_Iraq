import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import Shell from "@/components/Shell";
import { getLang, getTheme, getT } from "@/lib/prefs";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("client");
  const [lang, theme, t] = await Promise.all([getLang(), getTheme(), getT()]);

  const [openTasks, toReview] = await Promise.all([
    db.task.count({
      where: { clientId: user.id, status: { notIn: ["completed", "cancelled"] } },
    }),
    db.documentSubmission.count({
      where: { status: "pending", task: { clientId: user.id } },
    }),
  ]);

  return (
    <Shell
      roleLabel={user.clientProfile?.companyName ?? t.role.client}
      userName={user.fullName}
      lang={lang}
      theme={theme}
      groups={[
        {
          label: t.nav.work,
          items: [
            { href: "/client/new", label: t.nav.fileTask },
            { href: "/client/tasks", label: t.nav.myTasks, count: openTasks },
          ],
        },
        {
          label: t.nav.network,
          items: [{ href: "/client", label: t.nav.coverageMap }],
        },
      ]}
    >
      {toReview > 0 && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          {toReview} {toReview === 1 ? t.client.toReviewOne : t.client.toReviewMany}
        </div>
      )}
      {children}
    </Shell>
  );
}
