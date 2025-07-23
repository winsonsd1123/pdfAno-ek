// ======================================================================
// Supabase 服务端客户端
// ======================================================================
// 
// 这个文件提供服务端使用的 Supabase Admin 实例
// 
// ======================================================================

import { createClient } from '@supabase/supabase-js';

// 环境变量验证
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * 管理员客户端实例（仅限服务端使用）
 * 使用 service_role 密钥，能绕过所有 RLS 策略
 * ⚠️ 警告：这个客户端权限很高，只能在服务端 API 中使用，绝对不能暴露给前端
 */
export function createSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables for admin client');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
