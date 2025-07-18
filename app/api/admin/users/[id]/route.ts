// ======================================================================
// 用户管理 API - /api/admin/users/[id]
// ======================================================================
// 
// 提供单个用户的更新和删除功能，仅限管理员使用
// 支持的操作：
// - PUT: 更新用户信息
// - DELETE: 删除用户
// 
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { UserService } from '@/services/userService';
import { ApiResponse, UpdateUserRequest } from '@/models';

const userService = new UserService();

/**
 * PUT /api/admin/users/[id]
 * 更新用户信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const id = await params.id;
    if (!id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid User ID' },
        { status: 400 }
      );
    }

    const body: UpdateUserRequest = await request.json();
    await userService.updateUser(id, body);

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'User updated successfully' }
    );

  } catch (error: any) {
    console.error('Error in PUT /api/admin/users/[id]:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 * 删除用户
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const id = await params.id;
    if (!id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid User ID' },
        { status: 400 }
      );
    }

    await userService.deleteUser(id);

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'User deleted successfully' }
    );

  } catch (error: any) {
    console.error('Error in DELETE /api/admin/users/[id]:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || 'Internal server error' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
} 