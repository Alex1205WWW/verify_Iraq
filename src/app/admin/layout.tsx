import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import Shell from "@/components/Shell";
import DemoReset from "@/components/DemoReset";
import { getLang, getTheme, getT } from "@/lib/prefs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("admin");
  const [lang, theme, t] = await Promise.all([getLang(), getTheme(), getT()]);

  const [pendingApprovals, needsAssignment, openTasks] = await Promise.all([
    db.user.count({ where: { status: "pending" } }),
    db.task.count({ where: { status: "pending_assignment" } }),
    db.task.count({ where: { status: { notIn: ["completed", "cancelled"] } } }),
  ]);

  return (
    <Shell
      roleLabel={t.role.admin}
      userName={user.fullName}
      lang={lang}
      theme={theme}
      railFooter={<DemoReset />}
      groups={[
        {
          label: t.nav.dispatch,
          items: [
            { href: "/admin", label: t.nav.map },
            { href: "/admin/tasks", label: t.nav.tasks, count: openTasks },
          ],
        },
        {
          label: t.nav.network,
          items: [
            { href: "/admin/approvals", label: t.nav.approvals, count: pendingApprovals },
            { href: "/admin/people", label: t.nav.people },
          ],
        },
      ]}
    >
      {needsAssignment > 0 && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          {needsAssignment}{" "}
          {needsAssignment === 1 ? t.admin.needAssignOne : t.admin.needAssignMany}
        </div>
      )}
      {children}
    </Shell>
  );
}
