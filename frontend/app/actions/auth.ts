"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, loginUpstream } from "../lib/auth";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Ingresa email y contraseña." };
  }

  const result = await loginUpstream(email, password);
  if ("error" in result) {
    return { error: result.error };
  }

  (await cookies()).set(AUTH_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
