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
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { RoleManagementService } from '@/services/roleManagementService';
import { ApiResponse } from '@/models/api';
import { PermissionDto } from '@/models/permission';

const roleManagementService = new RoleManagementService();

/**
 * GET /api/admin/permissions
 * 获取所有可用权限列表
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const permissions = await roleManagementService.getAllPermissions();

    return NextResponse.json<ApiResponse<PermissionDto[]>>(
      { success: true, data: permissions }
    );

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/permissions:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
