import type { ReactNode } from "react";
import { Footer } from "./footer";
import { Navbar } from "./navbar";
export function PublicShell({ children }: { children: ReactNode }) { return <div className="min-h-screen bg-[#f8f7f3]"><Navbar />{children}<Footer /></div>; }
