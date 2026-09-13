"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { resetDemoData } from "@/lib/db";
import { clearStoredFiles } from "@/lib/files";

/**
 * Puts the virtual data back to where the demo starts, so the walkthrough can
 * be shown again from the top. Seeded accounts keep their ids, so nobody is
 * signed out by it.
 */
export async function resetDemoAction(): Promise<void> {
  await requireRole("admin");
  resetDemoData();
  clearStoredFiles();
  revalidatePath("/", "layout");
  redirect("/admin");
}
