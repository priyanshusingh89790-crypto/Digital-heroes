import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminDashboard } from "./admin-dashboard";
import { AuthenticationRequiredError, AuthorizationError, requireAdmin } from "@/lib/auth/authorization";
import { getAdminData, getAdminOverview } from "@/lib/admin/operations";

export default async function AdminPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/login");
    if (error instanceof AuthorizationError) redirect("/unauthorized");
    throw error;
  }

  const [data, overview] = await Promise.all([getAdminData(), getAdminOverview()]);
  return <AdminDashboard data={data} overview={overview} />;
}

export function AdminFallbackLink() {
  return <Link href="/dashboard">Back to dashboard</Link>;
}
