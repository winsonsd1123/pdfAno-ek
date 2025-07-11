// ======================================================================
// Supabase 服务端工具函数
// ======================================================================
// 
// 这个文件提供了服务端使用的 Supabase 客户端和工具函数
// 只能在服务端组件和 API 路由中使用
// 
// ======================================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createSupabaseAdminClient } from './supabase';

// 环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * 创建服务端客户端（用于服务端组件和 API 路由）
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // 在某些 middleware 中设置 cookie 可能会失败，忽略错误
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch (error) {
          // 忽略错误
        }
      },
    },
  });
}

/**
 * 从请求头中获取用户信息的工具函数
 * 主要用于 API 路由中验证用户身份
 */
export async function getServerUser() {
  try {
    const client = await createSupabaseServerClient();
    const { data: { user }, error } = await client.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting server user:', error);
    return null;
  }
}

/**
 * 验证用户是否为管理员的工具函数
 * 用于 API 路由中的权限检查
 */
export async function verifyAdminUser() {
  const client = await createSupabaseServerClient();
  const user = await getServerUser();
  
  if (!user) {
    return { isAdmin: false, user: null, error: 'Not authenticated' };
  }

  try {
    // 从 profiles 表获取用户角色信息
    const { data: profile, error } = await client
      .from('profiles')
      .select(`
        *,
        role:roles(*)
      `)
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return { isAdmin: false, user, error: 'Profile not found' };
    }

    const isAdmin = profile.role?.name === 'admin';
    
    return { 
      isAdmin, 
      user, 
      profile,
      error: isAdmin ? null : 'Insufficient permissions' 
    };
  } catch (error) {
    console.error('Error verifying admin user:', error);
    return { isAdmin: false, user, error: 'Verification failed' };
  }
} 