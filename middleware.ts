import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  try {
    // Get the token from the request
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    // Protected routes that require authentication
    const protectedRoutes = ["/pdfano", "/works", "/settings", "/admin"]

    // Check if the current path is a protected route
    const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))

    // If it's a protected route and user is not authenticated
    if (isProtectedRoute && !token) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Role-based access control for admin routes
    if (pathname.startsWith("/admin") && token?.role !== "admin") {
      // If a non-admin tries to access an admin route, redirect them to the homepage
      const homeUrl = new URL("/?error=access_denied", request.url)
      return NextResponse.redirect(homeUrl)
    }

    // If all checks pass, allow the request to proceed
    return NextResponse.next()
  } catch (error) {
    console.error("Middleware error:", error)
    // If there's an error in middleware, allow the request to proceed
    // This prevents the middleware from breaking the entire app
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
}
