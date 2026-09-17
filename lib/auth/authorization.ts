import "server-only";

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import { canAccessAdminArea, canAccessSubscriberArea, isApplicationRole } from "./roles";
import { hasActiveSubscription } from "@/lib/billing/access";
import type { AuthenticatedContext, CurrentProfile } from "./types";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required to access this resource.");
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "You are not authorized to access this resource.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Uses Supabase's validated server-side user lookup, never a client supplied id. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user;
}

/** Reads only the authenticated caller's profile under RLS. */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || !isApplicationRole(data.role)) {
    return null;
  }

  return data;
}

async function requireContext(): Promise<AuthenticatedContext> {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  if (!profile || profile.id !== user.id) {
    throw new AuthorizationError("Your account profile is unavailable.");
  }

  return { user, profile };
}

export async function requireSubscriber(): Promise<AuthenticatedContext> {
  const context = await requireContext();

  if (!canAccessSubscriberArea(context.profile.role)) { throw new AuthorizationError(); }
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("status, current_period_end, cancel_at_period_end, plan_interval").eq("user_id", context.user.id).order("current_period_end", { ascending: false }).limit(1).maybeSingle();
  if (!hasActiveSubscription(data)) { throw new AuthorizationError("An active subscription is required."); }

  return context;
}

export async function requireAdmin(): Promise<AuthenticatedContext> {
  const context = await requireContext();

  if (!canAccessAdminArea(context.profile.role)) {
    throw new AuthorizationError();
  }

  return context;
}
