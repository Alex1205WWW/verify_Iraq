"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { saveDataUrl, saveUpload } from "@/lib/files";
import { PHOTO_TYPES, type PhotoType } from "@/lib/types";
import { parseCoord } from "@/lib/format";

export type UploadState = { error?: string; ok?: string } | null;

/**
 * Site photo from the in-app camera.
 *
 * The coordinates arrive with the frame and are written into columns, not into
 * the image file, so nobody can edit them afterwards. The device clock is
 * recorded but never trusted — serverTime is the database default, set here.
 */
export async function saveSitePhoto(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireRole("researcher");

  const taskId = String(formData.get("taskId") ?? "");
  const dataUrl = String(formData.get("image") ?? "");
  const photoType = String(formData.get("photoType") ?? "") as PhotoType;
  const lat = parseCoord(formData.get("lat"), "lat");
  const lng = parseCoord(formData.get("lng"), "lng");
  const accuracyM = Number(formData.get("accuracy"));
  const deviceTimeRaw = String(formData.get("deviceTime") ?? "");

  if (!PHOTO_TYPES.includes(photoType)) return { error: "Pick exterior or interior." };
  if (!dataUrl) return { error: "No photo was captured." };
  if (lat === null || lng === null) {
    return { error: "No location was attached. Allow location access and try again." };
  }

  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task || task.assignedResearcherId !== user.id) {
    return { error: "That task is not yours." };
  }
  if (!task.startedAt) return { error: "Press Start work before taking photos." };

  let saved;
  try {
    saved = await saveDataUrl(dataUrl);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the photo." };
  }

  const deviceTime = deviceTimeRaw ? new Date(deviceTimeRaw) : new Date();

  await db.sitePhoto.create({
    data: {
      taskId,
      capturedById: user.id,
      photoType,
      storageKey: saved.key,
      lat,
      lng,
      accuracyM: Number.isFinite(accuracyM) ? accuracyM : 0,
      deviceTime: isNaN(deviceTime.getTime()) ? new Date() : deviceTime,
      // A browser cannot report this. A native app can, and the column is
      // already here for when one exists.
      isMockLocation: null,
    },
  });

  revalidatePath(`/researcher/tasks/${taskId}`);
  revalidatePath(`/client/tasks/${taskId}`);
  revalidatePath(`/admin/tasks/${taskId}`);
  return { ok: "Photo saved with its coordinates." };
}

/** Form or document photographed from the gallery, into a named slot. */
export async function uploadDocument(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireRole("researcher");

  const taskId = String(formData.get("taskId") ?? "");
  const slotLabel = String(formData.get("slotLabel") ?? "").trim();
  const file = formData.get("file");

  if (!slotLabel) return { error: "Missing the document slot." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };

  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task || task.assignedResearcherId !== user.id) {
    return { error: "That task is not yours." };
  }

  let saved;
  try {
    saved = await saveUpload(file);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the file." };
  }

  const last = await db.documentSubmission.findFirst({
    where: { taskId, slotLabel },
    orderBy: { version: "desc" },
  });

  await db.documentSubmission.create({
    data: {
      taskId,
      slotLabel,
      version: (last?.version ?? 0) + 1,
      storageKey: saved.key,
      fileName: saved.name,
      uploadedById: user.id,
      status: "pending",
    },
  });

  revalidatePath(`/researcher/tasks/${taskId}`);
  revalidatePath(`/client/tasks/${taskId}`);
  return { ok: "Uploaded. The company will review it." };
}

/**
 * Company accepts or rejects one submission. A rejection posts its note into
 * the chat so the discussion stays in a single thread.
 */
export async function reviewDocument(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireRole("client");

  const submissionId = String(formData.get("submissionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const submission = await db.documentSubmission.findUnique({
    where: { id: submissionId },
    include: { task: true },
  });
  if (!submission || submission.task.clientId !== user.id) {
    return { error: "That document is not yours to review." };
  }

  if (decision === "reject" && !note) {
    return { error: "Say what needs fixing so the researcher can correct it." };
  }

  await db.documentSubmission.update({
    where: { id: submissionId },
    data: {
      status: decision === "accept" ? "accepted" : "rejected",
      reviewedById: user.id,
      reviewedAt: new Date(),
      rejectionNote: decision === "reject" ? note : null,
    },
  });

  if (decision === "reject") {
    await db.message.create({
      data: {
        taskId: submission.taskId,
        senderId: user.id,
        isSystem: true,
        body: `"${submission.slotLabel}" was rejected: ${note}`,
      },
    });
    if (submission.task.assignedResearcherId) {
      await db.notification.create({
        data: {
          userId: submission.task.assignedResearcherId,
          taskId: submission.taskId,
          type: "document_rejected",
          body: `${submission.slotLabel} needs correcting on ${submission.task.reference}.`,
        },
      });
    }
  }

  revalidatePath(`/client/tasks/${submission.taskId}`);
  revalidatePath(`/researcher/tasks/${submission.taskId}`);
  return { ok: decision === "accept" ? "Accepted." : "Sent back with your note." };
}
