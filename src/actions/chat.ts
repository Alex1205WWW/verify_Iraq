"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { screenMessage } from "@/lib/filter";

export type ChatState = { error?: string; sent?: boolean } | null;

export async function sendMessage(
  _prev: ChatState,
  formData: FormData,
): Promise<ChatState> {
  const user = await requireRole("client", "researcher");
  const taskId = String(formData.get("taskId") ?? "");
  const raw = String(formData.get("body") ?? "");

  if (!raw.trim()) return null;

  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) return { error: "Task not found." };

  const mine = task.clientId === user.id || task.assignedResearcherId === user.id;
  if (!mine) return { error: "That task is not yours." };

  if (!task.startedAt) {
    return { error: "The channel opens once the researcher starts work." };
  }

  const screened = screenMessage(raw);

  if (screened.blocked) {
    // Logged, not silently dropped — the log is what shows the operator who
    // keeps trying to take the conversation off the platform.
    await db.blockedAttempt.create({
      data: {
        taskId,
        senderId: user.id,
        originalBody: raw,
        matchedRule: screened.rule,
      },
    });
    revalidatePath(`/client/tasks/${taskId}`);
    revalidatePath(`/researcher/tasks/${taskId}`);
    return { error: screened.reason };
  }

  await db.message.create({
    data: { taskId, senderId: user.id, body: screened.body },
  });

  revalidatePath(`/client/tasks/${taskId}`);
  revalidatePath(`/researcher/tasks/${taskId}`);
  revalidatePath(`/admin/tasks/${taskId}`);
  return { sent: true };
}
