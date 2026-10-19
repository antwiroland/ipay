import { NextResponse, type NextRequest } from "next/server";

const COOKIE = process.env.NODE_ENV === "production" ? "__Host-ipay_session" : "ipay_session";

/**
 * Coarse gate only: bounce obviously-signed-out visitors away from protected areas.
 * Real authorization happens in every page, server action and route handler (requireCustomerPage /
 * requireStaffPage / requirePermission) — never rely on this file for security.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if ((pathname.startsWith("/account") || pathname.startsWith("/admin")) && !req.cookies.get(COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/account/:path*", "/admin/:path*"] };
