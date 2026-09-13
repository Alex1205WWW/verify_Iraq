import { redirect } from "next/navigation";
import { currentUser, homeFor } from "@/lib/auth";

export default async function Index() {
  const user = await currentUser();
  redirect(user ? homeFor(user.role) : "/login");
}
