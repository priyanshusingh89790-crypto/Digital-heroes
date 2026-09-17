import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  requirePublicSupabaseEnv,
  requireSupabaseServiceRoleKey,
} from "./env";

/**
 * Bypasses RLS. It is intentionally server-only and is reserved for audited
 * administrative workflows, webhooks, and background jobs.
 */
export function createAdminClient() {
  const { url } = requirePublicSupabaseEnv();
  return createClient(url, requireSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
