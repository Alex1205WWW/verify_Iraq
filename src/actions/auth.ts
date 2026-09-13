"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, homeFor, verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { EXPERTISE } from "@/lib/types";

export type FormState = { error?: string; ok?: string } | null;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");

  if (!email || !password) return { error: "Enter your email and password." };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email and password do not match an account." };
  }

  if (user.status === "pending") redirect("/pending");
  if (user.status === "rejected") {
    return { error: "This application was not approved. Contact the operator." };
  }

  await createSession({ userId: user.id, role: user.role as "admin" });
  redirect(homeFor(user.role));
}

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const role = str(formData, "role");
  if (role !== "client" && role !== "researcher") {
    return { error: "Choose whether you are a company or a researcher." };
  }

  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const fullName = str(formData, "fullName");
  const phone = str(formData, "phone");
  const country = str(formData, "country");
  const city = str(formData, "city");

  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Use at least 8 characters for the password." };
  if (!fullName) return { error: "Enter your name." };
  if (!phone) return { error: "Enter a phone number." };
  if (!country || !city) return { error: "Enter your country and city." };

  const clash = await db.user.findUnique({ where: { email } });
  if (clash) return { error: "An account already exists with that email." };

  const passwordHash = await hashPassword(password);

  if (role === "client") {
    const companyName = str(formData, "companyName");
    if (!companyName) return { error: "Enter the company name." };
    await db.user.create({
      data: {
        role,
        email,
        passwordHash,
        fullName,
        phone,
        status: "pending",
        clientProfile: {
          create: { companyName, contactPerson: fullName, country, city },
        },
      },
    });
  } else {
    const whatsappNumber = str(formData, "whatsappNumber") || phone;
    const picked = formData
      .getAll("expertise")
      .map((v) => String(v))
      .filter((v) => (EXPERTISE as readonly string[]).includes(v));
    if (picked.length === 0) {
      return { error: "Choose at least one thing you can do." };
    }
    await db.user.create({
      data: {
        role,
        email,
        passwordHash,
        fullName,
        phone,
        status: "pending",
        researcherProfile: {
          create: {
            whatsappNumber,
            country,
            city,
            expertise: picked.join(","),
            coverageNote: str(formData, "coverageNote"),
          },
        },
      },
    });
  }

  redirect("/pending");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
