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

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// 需要认证的路由模式
const protectedRoutes = [
  '/pdfano',
  '/works',
  '/admin'
];

// 管理员专用路由
const adminRoutes = [
  '/admin'
];

// 公开路由（不需要认证）
const publicRoutes = [
  '/',
  '/login',
  '/signup',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过 API 路由、静态文件和内部 Next.js 路由
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 公开路由直接放行
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next();
  }

  try {
    // 检查用户认证状态
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    // 如果获取用户信息失败或用户未登录
    if (error || !user) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // 检查是否需要管理员权限
    if (adminRoutes.some(route => pathname.startsWith(route))) {
      try {
        // 检查用户是否有管理员权限
        const { data: profile } = await supabase
          .from('profiles')
          .select(`
            *,
            role:roles(*)
          `)
          .eq('id', user.id)
          .single();

        const isAdmin = profile?.role?.name === 'admin';

        if (!isAdmin) {
          // 没有管理员权限，重定向到主页
          const redirectUrl = new URL('/', request.url);
          redirectUrl.searchParams.set('error', 'access_denied');
          return NextResponse.redirect(redirectUrl);
        }
      } catch (adminError) {
        console.error('Error checking admin permissions:', adminError);
        // 数据库查询失败，为安全起见拒绝访问
        const redirectUrl = new URL('/', request.url);
        redirectUrl.searchParams.set('error', 'permission_check_failed');
        return NextResponse.redirect(redirectUrl);
      }
    }

    // 通过所有检查，允许访问
    return NextResponse.next();

  } catch (error) {
    console.error('Middleware error:', error);
    
    // 发生未预期的错误，重定向到登录页
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    redirectUrl.searchParams.set('error', 'auth_error');
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - api 路由
     * - _next/static (静态文件)
     * - _next/image (图像优化文件)
     * - favicon.ico (网站图标)
     * - 其他静态资源
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}; 