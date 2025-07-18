// ======================================================================
// 用户管理 API - /api/admin/users
// ======================================================================
// 
// 提供用户的增删改查功能，仅限管理员使用
// 支持的操作：
// - GET: 获取用户列表（支持分页和搜索）
// - POST: 创建新用户
// 
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { UserService } from '@/services/userService';
import { ApiResponse, CreateUserRequest } from '@/models';

const userService = new UserService();

/**
 * GET /api/admin/users
 * 获取用户列表（支持分页和搜索）
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'updated_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const result = await userService.getUsers({
      pagination: { page, limit },
      search,
      sortBy,
      sortOrder,
    });

    return NextResponse.json<ApiResponse>({ success: true, data: result });

  } catch (error) {
    console.error('Error in GET /api/admin/users:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * 创建新用户
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

    const body: CreateUserRequest = await request.json();

    // 基础验证
    if (!body.email || !body.password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const result = await userService.createUser(body);

    return NextResponse.json<ApiResponse>(
      { 
        success: true, 
        message: 'User created successfully',
        data: result
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error in POST /api/admin/users:', error);
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: error.message || 'Internal server error'
      },
      { status: error.message?.includes('already exists') ? 400 : 500 }
    );
  }
} 