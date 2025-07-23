// ======================================================================
// 角色权限管理 API - /api/admin/roles/[id]/permissions
// ======================================================================
// 
// 提供角色权限的查询和更新功能，仅限管理员使用
// 支持的操作：
// - GET: 获取角色的权限列表
// - PUT: 更新角色的权限列表
// 
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { RoleManagementService } from '@/services/roleManagementService';
import { ApiResponse } from '@/models/api';
import { PermissionDto } from '@/models/permission';
import { UpdateRolePermissionsDto } from '@/models/role';

const roleManagementService = new RoleManagementService();

/**
 * GET /api/admin/roles/[id]/permissions
 * 获取角色的权限列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无效的角色ID' },
        { status: 400 }
      );
    }

    const permissions = await roleManagementService.getRolePermissions(roleId);

    return NextResponse.json<ApiResponse<PermissionDto[]>>(
      { success: true, data: permissions }
    );

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/roles/[id]/permissions:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/roles/[id]/permissions
 * 更新角色的权限列表
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无效的角色ID' },
        { status: 400 }
      );
    }

    const body: UpdateRolePermissionsDto = await request.json();
    if (!Array.isArray(body.permissions)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '权限列表格式无效' },
        { status: 400 }
      );
    }

    await roleManagementService.updateRolePermissions(roleId, body);

    return NextResponse.json<ApiResponse>(
      { success: true, message: '角色权限更新成功' }
    );

  } catch (error) {
    console.error('Unexpected error in PUT /api/admin/roles/[id]/permissions:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: error instanceof Error && error.message.includes('无效') ? 400 : 500 }
    );
  }
}
