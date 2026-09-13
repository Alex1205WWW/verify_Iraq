import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import Shell from "@/components/Shell";
import { getLang, getTheme, getT } from "@/lib/prefs";

export default async function ResearcherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("researcher");
  const [lang, theme, t] = await Promise.all([getLang(), getTheme(), getT()]);

  const open = await db.task.count({
    where: {
      assignedResearcherId: user.id,
      status: { notIn: ["completed", "cancelled"] },
    },
  });

  return (
    <Shell
      roleLabel={t.role.researcher}
      userName={user.fullName}
      lang={lang}
      theme={theme}
      groups={[
        {
          label: t.nav.work,
          items: [{ href: "/researcher", label: t.nav.myTasks, count: open }],
        },
      ]}
    >
      {children}
    </Shell>
  );
}
