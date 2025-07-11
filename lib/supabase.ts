// ======================================================================
// Supabase 客户端配置和实例
// ======================================================================
// 
// 这个文件提供了客户端使用的 Supabase 实例
// 服务端相关的代码已移至单独的文件中
// 
// ======================================================================

import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseConfig } from '@/types/supabase';

// 环境变量验证
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * 客户端 Supabase 实例
 * 用于浏览器环境，受行级安全 (RLS) 策略限制
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 创建浏览器端客户端（用于客户端组件）
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}

/**
 * 管理员客户端实例（仅限服务端使用）
 * 使用 service_role 密钥，能绕过所有 RLS 策略
 * ⚠️ 警告：这个客户端权限很高，只能在服务端 API 中使用，绝对不能暴露给前端
 */
export function createSupabaseAdminClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }

  return createClient(supabaseUrl!, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 配置对象导出（用于其他地方需要配置信息时）
 */
export const supabaseConfig: SupabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  serviceRoleKey: supabaseServiceRoleKey,
}; 