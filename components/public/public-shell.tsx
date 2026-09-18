import type { ReactNode } from "react";
import { Footer } from "./footer";
import { Navbar } from "./navbar";
import { getCurrentUser } from "@/lib/auth/authorization";

export async function PublicShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-[#f8f7f3]">
      <Navbar isAuthenticated={Boolean(user)} />
      {children}
      <Footer />
    </div>
  );
}
