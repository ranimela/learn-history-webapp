import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, Next internals, gate page, and auth API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/gate" ||
    pathname === "/api/auth/gate" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("quiz_auth")?.value;
  const isAuthenticated = authCookie === "authenticated";

  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized. Passcode required." },
        { status: 401 }
      );
    }

    const gateUrl = new URL("/gate", request.url);
    gateUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(gateUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
