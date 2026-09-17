import { redirect } from "next/navigation";

import { AuthenticationRequiredError, AuthorizationError, requireAdmin } from "@/lib/auth/authorization";

export default async function AdminAccessPage() {
  await authorizeAdmin();
  return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-semibold">Administrator access confirmed</h1><p className="mt-2 text-muted-foreground">The admin dashboard is scheduled for a later phase.</p></main>;
}

async function authorizeAdmin() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/login");
    if (error instanceof AuthorizationError) redirect("/unauthorized");
    throw error;
  }
}
