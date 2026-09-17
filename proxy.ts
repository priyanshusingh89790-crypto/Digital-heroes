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

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const isProtected = request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/admin");

  if (isProtected && !user) {
    return redirectToLogin(request, response);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/signup"],
};
