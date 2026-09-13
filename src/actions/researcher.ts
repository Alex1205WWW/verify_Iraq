"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function setAvailability(available: boolean) {
  const user = await requireRole("researcher");
  await db.researcherProfile.update({
    where: { userId: user.id },
    data: { isAvailable: available },
  });
  revalidatePath("/researcher");
  revalidatePath("/admin");
  revalidatePath("/client");
}
