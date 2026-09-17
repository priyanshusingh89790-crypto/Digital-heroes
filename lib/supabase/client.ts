import { createBrowserClient } from "@supabase/ssr";

import { requirePublicSupabaseEnv } from "./env";

/** Use only from Client Components. This client is constrained by RLS. */
export function createClient() {
  const { url, publishableKey } = requirePublicSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
