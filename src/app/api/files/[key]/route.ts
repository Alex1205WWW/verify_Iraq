import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { mimeForKey, readStored } from "@/lib/files";

/**
 * Uploads are never served as static files. Every request is checked against
 * the caller's relationship to the task before any bytes go out.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const { key } = await params;

  const [photo, doc, attachment] = await Promise.all([
    db.sitePhoto.findFirst({ where: { storageKey: key }, include: { task: true } }),
    db.documentSubmission.findFirst({
      where: { storageKey: key },
      include: { task: true },
    }),
    db.taskAttachment.findFirst({
      where: { storageKey: key },
      include: { task: true },
    }),
  ]);

  const task = photo?.task ?? doc?.task ?? attachment?.task;
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const permitted =
    user.role === "admin" ||
    task.clientId === user.id ||
    task.assignedResearcherId === user.id;

  if (!permitted) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  try {
    const buf = await readStored(key);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mimeForKey(key),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
