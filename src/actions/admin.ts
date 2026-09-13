"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { sendOffer } from "@/lib/whatsapp";

export async function decideApplication(userId: string, approve: boolean) {
  const admin = await requireRole("admin");

  const user = await db.user.update({
    where: { id: userId },
    data: approve
      ? { status: "approved", approvedAt: new Date(), approvedById: admin.id }
      : { status: "rejected" },
  });

  if (approve) {
    await db.notification.create({
      data: {
        userId: user.id,
        type: "account_approved",
        body: "Your account has been approved. You can sign in now.",
      },
    });
  }

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/people");
}

/**
 * Offer the task to a researcher. The offer row is written before the message
 * goes out so the webhook has something to match Meta's message id against.
 */
export async function offerTask(taskId: string, researcherId: string) {
  await requireRole("admin");

  const [task, researcher] = await Promise.all([
    db.task.findUnique({ where: { id: taskId } }),
    db.user.findUnique({
      where: { id: researcherId },
      include: { researcherProfile: true },
    }),
  ]);

  if (!task) throw new Error("Task not found.");
  if (!researcher?.researcherProfile) throw new Error("Researcher not found.");
  if (task.status !== "pending_assignment" && task.status !== "offered") {
    throw new Error("This task is already past the assignment stage.");
  }

  const offer = await db.taskOffer.create({
    data: { taskId, researcherId, response: "pending" },
  });

  const result = await sendOffer({
    toNumber: researcher.researcherProfile.whatsappNumber,
    researcherName: researcher.fullName,
    reference: task.reference,
    addressText: task.addressText,
  });

  await db.taskOffer.update({
    where: { id: offer.id },
    data: { waMessageId: result.messageId, dryRun: result.dryRun },
  });

  await db.task.update({ where: { id: taskId }, data: { status: "offered" } });

  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath("/admin/tasks");
  revalidatePath("/admin");
}

/**
 * Record a researcher's answer. Called by the WhatsApp webhook, and by the
 * admin's simulate buttons while Meta credentials are not configured.
 */
export async function resolveOffer(offerId: string, accepted: boolean) {
  const offer = await db.taskOffer.findUnique({
    where: { id: offerId },
    include: { task: true, researcher: true },
  });
  if (!offer) throw new Error("Offer not found.");
  if (offer.response !== "pending") return;

  await db.taskOffer.update({
    where: { id: offerId },
    data: { response: accepted ? "accepted" : "declined", respondedAt: new Date() },
  });

  if (accepted) {
    await db.task.update({
      where: { id: offer.taskId },
      data: { status: "assigned", assignedResearcherId: offer.researcherId },
    });
    await db.notification.create({
      data: {
        userId: offer.task.clientId,
        taskId: offer.taskId,
        type: "researcher_assigned",
        body: `A researcher has been assigned to ${offer.task.reference}.`,
      },
    });
  } else {
    // Straight back to the queue so the operator can pick someone else.
    await db.task.update({
      where: { id: offer.taskId },
      data: { status: "pending_assignment" },
    });
  }

  revalidatePath(`/admin/tasks/${offer.taskId}`);
  revalidatePath("/admin/tasks");
  revalidatePath("/admin");
  revalidatePath("/researcher");
  revalidatePath("/client/tasks");
}

/** Admin simulate button — only meaningful while WhatsApp is in dry run. */
export async function simulateOfferResponse(offerId: string, accepted: boolean) {
  await requireRole("admin");
  await resolveOffer(offerId, accepted);
}

export async function forceCloseTask(taskId: string) {
  const admin = await requireRole("admin");
  await db.task.update({
    where: { id: taskId },
    data: { status: "completed", closedAt: new Date(), closedById: admin.id },
  });
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (task) {
    await db.notification.create({
      data: {
        userId: task.clientId,
        taskId,
        type: "task_closed",
        body: `${task.reference} was closed by the operator.`,
      },
    });
  }
  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath("/admin/tasks");
}

export async function setUserSuspended(userId: string, suspended: boolean) {
  await requireRole("admin");
  await db.user.update({
    where: { id: userId },
    data: { status: suspended ? "rejected" : "approved" },
  });
  revalidatePath("/admin/people");
}
