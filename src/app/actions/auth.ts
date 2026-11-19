"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

export interface FormState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
}

const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

export async function signInAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("signin", 10, 60_000)).ok) return { error: "Too many attempts. Please wait a minute." };
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter your email and password." };
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message === "Email not confirmed" ? "Please verify your email first — check your inbox." : "Incorrect email or password." };
  redirect(safeNext(fd.get("next")));
}

export async function signUpAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("signup", 5, 60_000)).ok) return { error: "Too many attempts. Please wait a minute." };
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, "Enter your name"),
      email: z.string().trim().email("Enter a valid email"),
      phone: z.string().trim().optional(),
      password: z.string().min(10, "Use at least 10 characters").regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
      privacy: z.literal("on", { message: "Please accept the privacy policy" }),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    parsed.error.issues.forEach((i) => (fe[String(i.path[0])] = i.message));
    return { fieldErrors: fe };
  }
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
      emailRedirectTo: `${env.siteUrl}/auth/callback?next=/account`,
    },
  });
  if (error) return { error: error.message };
  return { success: "Check your email to verify your account, then sign in." };
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("forgot", 5, 60_000)).ok) return { error: "Too many attempts. Please wait a minute." };
  const email = String(fd.get("email") ?? "");
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email." };
  const supabase = await createUserClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password` });
  return { success: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const pw = String(fd.get("password") ?? "");
  if (pw.length < 10 || !/\d/.test(pw)) return { error: "Use at least 10 characters including a number." };
  const supabase = await createUserClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: "Your reset link has expired. Please request a new one." };
  redirect("/account?reset=1");
}

export async function signOutAction() {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/");
}
