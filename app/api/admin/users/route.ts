// ======================================================================
// 用户管理 API - /api/admin/users
// ======================================================================
// 
// 提供用户的增删改查功能，仅限管理员使用
// 支持的操作：
// - GET: 获取用户列表（支持分页和搜索）
// - POST: 创建新用户
// - PUT: 更新用户信息
// - DELETE: 删除用户
// 
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { verifyAdminUser } from '@/lib/supabase-server';
import type { 
  ApiResponse, 
  CreateUserInput, 
  UpdateUserInput, 
  UserWithRole,
  PaginationParams,
  PaginatedResponse 
} from '@/types/supabase';

/**
 * GET /api/admin/users
 * 获取用户列表（支持分页和搜索）
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'updated_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const supabase = createSupabaseAdminClient();

    // 构建查询
    let query = supabase
      .from('profiles')
      .select(`
        *,
        role:roles(*)
      `, { count: 'exact' });

    // 添加搜索条件
    if (search) {
      query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,id_number.ilike.%${search}%`);
    }

    // 添加排序
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // 添加分页
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: profiles, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    const response: PaginatedResponse<UserWithRole> = {
      data: profiles || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<UserWithRole>>>(
      { success: true, data: response }
    );

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/users:', error);
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
    // 验证管理员权限
    const { isAdmin, error: authError } = await verifyAdminUser();
    if (!isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateUserInput = await request.json();
    const { email, password, username, full_name, id_number, role_id } = body;

    // 基础验证
    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // 创建认证用户
    const { data: authUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 管理员创建的用户自动确认邮箱
    });

    if (createUserError || !authUser.user) {
      console.error('Error creating auth user:', createUserError);
      return NextResponse.json<ApiResponse>(
        { success: false, error: createUserError?.message || 'Failed to create user' },
        { status: 400 }
      );
    }

    // 更新 profile 信息
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        username,
        full_name,
        id_number,
        role_id: role_id || 2, // 默认为普通用户角色
        updated_at: new Date().toISOString(),
      })
      .eq('id', authUser.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // 如果 profile 更新失败，删除已创建的认证用户
      await supabase.auth.admin.deleteUser(authUser.user.id);
      
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to create user profile' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>(
      { 
        success: true, 
        message: 'User created successfully',
        data: { id: authUser.user.id, email: authUser.user.email }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Unexpected error in POST /api/admin/users:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 