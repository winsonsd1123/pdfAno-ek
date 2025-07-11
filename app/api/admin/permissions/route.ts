// ======================================================================
// 权限查询 API - /api/admin/permissions
// ======================================================================
// 
// 提供权限列表的查询功能，仅限管理员使用
// 支持的操作：
// - GET: 获取所有可用权限列表
// 
// 注意：权限本身不支持动态创建/删除，它们是系统预定义的
// 
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { verifyAdminUser } from '@/lib/supabase-server';
import type { ApiResponse, Permission } from '@/types/supabase';

/**
 * GET /api/admin/permissions
 * 获取所有可用权限列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const { isAdmin, error: authError } = await verifyAdminUser();
    if (!isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // 获取所有权限
    const { data: permissions, error } = await supabase
      .from('permissions')
      .select('*')
      .order('subject', { ascending: true })
      .order('action', { ascending: true });

    if (error) {
      console.error('Error fetching permissions:', error);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to fetch permissions' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Permission[]>>(
      { success: true, data: permissions || [] }
    );

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/permissions:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 