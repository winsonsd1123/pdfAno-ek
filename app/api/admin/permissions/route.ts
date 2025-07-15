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
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import type { ApiResponse, Permission } from '@/types/supabase';

/**
 * GET /api/admin/permissions
 * 获取所有可用权限列表
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== 'admin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
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