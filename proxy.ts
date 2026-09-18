import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

function redirectToLogin(request: NextRequest, response: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

function redirectAuthenticatedAuthPage(request: NextRequest, response: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = "/dashboard";
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (isProtected && !user) {
    return redirectToLogin(request, response);
  }

  if (isAuthPage && user) {
    return redirectAuthenticatedAuthPage(request, response);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/signup"],
};
