"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/charities", label: "Charities" },
  { href: "/pricing", label: "Pricing" },
];

export function Navbar({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const [open, setOpen] = useState(false);
  const accountLink = isAuthenticated ? { href: "/dashboard", label: "Dashboard" } : { href: "/login", label: "Log in" };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#f8f7f3]/90 backdrop-blur">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8" aria-label="Main navigation">
        <Link href="/" className="font-semibold tracking-tight text-slate-950">
          digital<span className="text-emerald-600">heroes</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <Link key={link.href} className="text-sm text-slate-600 transition hover:text-slate-950" href={link.href}>
              {link.label}
            </Link>
          ))}
          <Link className="text-sm font-medium text-slate-700" href={accountLink.href}>
            {accountLink.label}
          </Link>
          {!isAuthenticated && (
            <Link className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700" href="/signup">
              Get started
            </Link>
          )}
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-slate-900 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          <span className="sr-only">{open ? "Close navigation" : "Open navigation"}</span>
        </button>
      </nav>

      {open && (
        <div id="mobile-nav" className="border-t border-slate-200 bg-[#f8f7f3] px-5 py-5 md:hidden">
          {links.map((link) => (
            <Link onClick={() => setOpen(false)} key={link.href} className="block py-3 text-slate-700" href={link.href}>
              {link.label}
            </Link>
          ))}
          <div className="mt-3 flex gap-3">
            <Link href={accountLink.href} onClick={() => setOpen(false)} className="rounded-full border px-4 py-2 text-sm">
              {accountLink.label}
            </Link>
            {!isAuthenticated && (
              <Link href="/signup" onClick={() => setOpen(false)} className="rounded-full bg-slate-950 px-4 py-2 text-sm text-white">
                Get started
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
