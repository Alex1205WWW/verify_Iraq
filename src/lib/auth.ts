import "server-only";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { readSession } from "./session";
import type { Role } from "./types";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function currentUser() {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { clientProfile: true, researcherProfile: true },
  });
  if (!user || user.status !== "approved") return null;
  return user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/** Send an approved user to their own home. */
export function homeFor(role: string): string {
  if (role === "admin") return "/admin";
  if (role === "client") return "/client";
  return "/researcher";
}

/**
 * Guard for every page and action. Roles are checked on the server, so a
 * company account never receives a researcher's contact details in the first
 * place — they are not merely hidden in the interface.
 */
export async function requireRole(...allowed: Role[]): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!allowed.includes(user.role as Role)) redirect(homeFor(user.role));
  return user;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
