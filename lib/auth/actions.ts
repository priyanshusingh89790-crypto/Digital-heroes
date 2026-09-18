"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { type AuthFormState } from "./form-state";
import { loginSchema, signupSchema } from "./validation";

function fields(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

/**
 * The profile trigger normally creates this row. This fallback makes auth
 * resilient when a Supabase project was created before the latest migrations
 * were applied. It only inserts a missing profile and never changes an
 * existing role.
 */
async function ensureSubscriberProfile(userId: string, fullName: string | null) {
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (lookupError) {
    throw new Error("Unable to verify your account profile.");
  }

  if (!existing) {
    const { error } = await admin.from("profiles").insert({
      id: userId,
      full_name: fullName,
      role: "subscriber",
    });

    if (error) {
      throw new Error("Unable to create your account profile.");
    }
  }
}

export async function loginAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(fields(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return {
      status: "error",
      message: error?.message ?? "Unable to sign in with those credentials.",
    };
  }

  try {
    await ensureSubscriberProfile(
      data.user.id,
      data.user.user_metadata?.full_name ?? null,
    );
  } catch (profileError) {
    await supabase.auth.signOut();
    return {
      status: "error",
      message:
        profileError instanceof Error
          ? profileError.message
          : "Unable to prepare your account.",
    };
  }

  redirect("/dashboard");
}

export async function signupAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(fields(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) {
    return {
      status: "error",
      message: error.message || "Unable to create your account. Please try again.",
    };
  }

  // Supabase can intentionally return no error for an already registered
  // email when email enumeration protection is enabled.
  if (data.user?.identities?.length === 0) {
    return {
      status: "error",
      message: "An account with this email already exists. Please sign in.",
    };
  }

  if (!data.user) {
    return {
      status: "error",
      message: "Unable to create your account. Please try again.",
    };
  }

  if (data.session) {
    try {
      await ensureSubscriberProfile(
        data.user.id,
        data.user.user_metadata?.full_name ?? parsed.data.fullName,
      );
    } catch (profileError) {
      return {
        status: "error",
        message:
          profileError instanceof Error
            ? profileError.message
            : "Unable to prepare your account.",
      };
    }

    redirect("/dashboard");
  }

  return {
    status: "success",
    message: "Account created. Check your inbox to confirm your email, then sign in.",
  };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
