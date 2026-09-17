"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { type AuthFormState } from "./form-state";
import { loginSchema, signupSchema } from "./validation";

function fields(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function loginAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(fields(formData));

  if (!parsed.success) {
    return { status: "error", message: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", message: "Unable to sign in with those credentials." };
  }

  redirect("/dashboard");
}

export async function signupAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(fields(formData));

  if (!parsed.success) {
    return { status: "error", message: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) {
    return { status: "error", message: "Unable to create your account. Please try again." };
  }

  // The database trigger creates profiles with the safe subscriber default.
  if (data.session) {
    redirect("/dashboard");
  }

  return { status: "success", message: "Check your inbox to confirm your email, then sign in." };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
