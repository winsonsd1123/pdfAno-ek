// ======================================================================
// 角色管理 API - /api/admin/roles
// ======================================================================
// 
// 提供角色的增删改查功能，仅限管理员使用
// 支持的操作：
// - GET: 获取角色列表
// - POST: 创建新角色
// 
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { RoleManagementService } from '@/services/roleManagementService';
import { ApiResponse } from '@/models/api';
import { CreateRoleDto, RoleDto, RoleWithStatsDto } from '@/models/role';

const roleManagementService = new RoleManagementService();

/**
 * GET /api/admin/roles
 * 获取角色列表
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

    const roles = await roleManagementService.getAllRoles();

    return NextResponse.json<ApiResponse<RoleWithStatsDto[]>>(
      { success: true, data: roles }
    );

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/roles:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/roles
 * 创建新角色
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body: CreateRoleDto = await request.json();

    // 基础验证
    if (!body.name) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '角色名称不能为空' },
        { status: 400 }
      );
    }

    const newRole = await roleManagementService.createRole(body);

    return NextResponse.json<ApiResponse<RoleDto>>(
      { 
        success: true, 
        message: '角色创建成功',
        data: newRole
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Unexpected error in POST /api/admin/roles:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: error instanceof Error && error.message.includes('已存在') ? 400 : 500 }
    );
  }
}
