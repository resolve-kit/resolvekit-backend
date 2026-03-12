"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  PRESENTATION_ACCESS_COOKIE_NAME,
  PRESENTATION_ENTRY_PATH,
  getPresentationAccessCookieValue,
  getPresentationPassword,
  getPublicPresentationPath,
  sanitizePresentationReturnPath,
} from "@/lib/presentation-access";

export async function submitPresentationAccess(formData: FormData): Promise<never> {
  const nextValue = sanitizePresentationReturnPath(formData.get("next")?.toString());
  const submittedPassword = formData.get("password")?.toString() ?? "";
  const configuredPassword = getPresentationPassword();
  const cookieValue = await getPresentationAccessCookieValue();

  if (!configuredPassword || !cookieValue) {
    redirect(`${PRESENTATION_ENTRY_PATH}?error=config`);
  }

  if (submittedPassword !== configuredPassword) {
    redirect(`${PRESENTATION_ENTRY_PATH}?error=invalid&next=${encodeURIComponent(nextValue)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(PRESENTATION_ACCESS_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: getPublicPresentationPath() ?? "/",
  });

  redirect(nextValue);
}

export async function clearPresentationAccess(): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.delete(PRESENTATION_ACCESS_COOKIE_NAME);
  redirect(PRESENTATION_ENTRY_PATH);
}
