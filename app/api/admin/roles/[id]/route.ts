// ======================================================================
// 角色管理 API - /api/admin/roles/[id]
// ======================================================================
// 
// 提供单个角色的查询、更新和删除功能，仅限管理员使用
// 支持的操作：
// - GET: 获取角色详情
// - PUT: 更新角色信息
// - DELETE: 删除角色
// 
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { RoleManagementService } from '@/services/roleManagementService';
import { ApiResponse } from '@/models/api';
import { RoleDto, UpdateRoleDto, RoleWithPermissionsDto } from '@/models/role';

const roleManagementService = new RoleManagementService();

/**
 * GET /api/admin/roles/[id]
 * 获取角色详情
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

    const role = await roleManagementService.getRoleById(roleId);
    if (!role) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '角色不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<RoleWithPermissionsDto>>(
      { success: true, data: role }
    );

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/roles/[id]:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/roles/[id]
 * 更新角色信息
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

    const body: UpdateRoleDto = await request.json();
    const updatedRole = await roleManagementService.updateRole(roleId, body);

    return NextResponse.json<ApiResponse<RoleDto>>(
      { 
        success: true, 
        message: '角色更新成功',
        data: updatedRole
      }
    );

  } catch (error) {
    console.error('Unexpected error in PUT /api/admin/roles/[id]:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: error instanceof Error && error.message.includes('已被使用') ? 409 : 500 }
    );
  }
}

/**
 * DELETE /api/admin/roles/[id]
 * 删除角色
 */
export async function DELETE(
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

    await roleManagementService.deleteRole(roleId);

    return NextResponse.json<ApiResponse>(
      { success: true, message: '角色删除成功' }
    );

  } catch (error) {
    console.error('Unexpected error in DELETE /api/admin/roles/[id]:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: error instanceof Error && error.message.includes('不能删除') ? 403 : 500 }
    );
  }
} 