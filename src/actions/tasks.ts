"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { saveUpload } from "@/lib/files";
import { parseCoord } from "@/lib/format";

export type FormState = { error?: string } | null;

/** VR-1042 style references, sequential and readable on a phone. */
async function nextReference(): Promise<string> {
  const count = await db.task.count();
  return `VR-${1000 + count + 1}`;
}

export async function createTask(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("client");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const addressText = String(formData.get("addressText") ?? "").trim();
  const lat = parseCoord(formData.get("lat"), "lat");
  const lng = parseCoord(formData.get("lng"), "lng");

  if (!title) return { error: "Give the task a short title." };
  if (!addressText) return { error: "Enter the address, or drop a pin on the map." };
  if (lat === null || lng === null) {
    return { error: "Pick the location on the map so it has coordinates." };
  }

  const reference = await nextReference();

  const task = await db.task.create({
    data: {
      reference,
      clientId: user.id,
      title,
      description,
      addressText,
      lat,
      lng,
      status: "pending_assignment",
    },
  });

  // Document slots are not rows until something is uploaded into them. The
  // canonical list lives in DEFAULT_DOC_SLOTS and both sides render against it.
  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File);
  for (const file of files) {
    if (file.size === 0) continue;
    const saved = await saveUpload(file);
    await db.taskAttachment.create({
      data: {
        taskId: task.id,
        uploadedById: user.id,
        fileName: saved.name,
        mimeType: saved.mime,
        sizeBytes: saved.size,
        storageKey: saved.key,
      },
    });
  }

  revalidatePath("/client/tasks");
  revalidatePath("/admin/tasks");
  revalidatePath("/admin");
  redirect(`/client/tasks/${task.id}`);
}

export async function startWork(taskId: string) {
  const user = await requireRole("researcher");
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task || task.assignedResearcherId !== user.id) {
    throw new Error("That task is not yours.");
  }
  if (task.status !== "assigned") return;

  await db.task.update({
    where: { id: taskId },
    data: { status: "in_progress", startedAt: new Date() },
  });

  await db.message.create({
    data: {
      taskId,
      senderId: user.id,
      isSystem: true,
      body: "The researcher has started work. This channel is now open.",
    },
  });

  revalidatePath(`/researcher/tasks/${taskId}`);
  revalidatePath(`/client/tasks/${taskId}`);
}

export async function markComplete(taskId: string) {
  const user = await requireRole("researcher", "client");
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found.");

  const isResearcher = task.assignedResearcherId === user.id;
  const isClient = task.clientId === user.id;
  if (!isResearcher && !isClient) throw new Error("That task is not yours.");

  const data: Record<string, unknown> = {};
  if (isResearcher) data.researcherDoneAt = new Date();
  if (isClient) data.clientDoneAt = new Date();

  const researcherDone = isResearcher ? true : Boolean(task.researcherDoneAt);
  const clientDone = isClient ? true : Boolean(task.clientDoneAt);

  if (researcherDone && clientDone) {
    data.status = "completed";
    data.closedAt = new Date();
  } else {
    data.status = "under_review";
  }

  await db.task.update({ where: { id: taskId }, data });

  revalidatePath(`/researcher/tasks/${taskId}`);
  revalidatePath(`/client/tasks/${taskId}`);
  revalidatePath("/admin/tasks");
}
