// ======================================================================
// 中间件 - 路由保护和权限验证
// ======================================================================
// 
// 功能：
// 1. 保护需要认证的路由
// 2. 管理员权限验证
// 3. 自动重定向到登录页
// 
// 重构后：配合新的API认证流程
// 
// ======================================================================

import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req) {
    const { token } = req.nextauth
    const { pathname } = req.nextUrl

    // Role-based access control for admin routes
    if (pathname.startsWith("/admin") && token?.role !== "admin") {
      // If a non-admin tries to access an admin route, redirect them to the homepage.
      return NextResponse.redirect(new URL("/?error=access_denied", req.url))
    }

    // If all checks pass, allow the request to proceed.
    return NextResponse.next()
  },
  {
    callbacks: {
      /**
       * This callback is used to decide if a user is authorized to access a page.
       * It's called before the `middleware` function above.
       * Returning `true` continues the middleware chain.
       * Returning `false` redirects to the sign-in page.
       */
      authorized: ({ token }) => {
        // !!token returns true if the token exists (user is logged in), otherwise false.
        return !!token
      },
    },
    // If `authorized` returns false, NextAuth will redirect to this page.
    pages: {
      signIn: "/login",
    },
  }
)

// The `matcher` configuration specifies which routes the middleware should apply to.
export const config = {
  matcher: [
    "/pdfano/:path*",
    "/works/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
} 