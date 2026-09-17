import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requirePublicSupabaseEnv } from "./env";

/**
 * Use in Server Components, Server Actions, and Route Handlers. Authentication
 * is cookie-backed and database access remains subject to RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = requirePublicSupabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The request proxy added in
          // the authentication phase will refresh sessions when necessary.
        }
      },
    },
  });
}
