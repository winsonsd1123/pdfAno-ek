// ======================================================================
// 角色管理 API - /api/admin/roles
// ======================================================================
// 
// 提供角色的增删改查功能，仅限管理员使用
// 支持的操作：
// - GET: 获取角色列表
// - POST: 创建新角色
// - PUT: 更新角色信息
// - DELETE: 删除角色
// 
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { verifyAdminUser } from '@/lib/supabase-server';
import type { 
  ApiResponse, 
  Role,
  CreateRoleInput, 
  UpdateRoleInput,
  RoleWithCounts // 替换 RoleWithPermissions
} from '@/types/supabase';

/**
 * GET /api/admin/roles
 * 获取角色列表
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
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const search = searchParams.get('search') || '';

    const supabase = createSupabaseAdminClient();
    
    // 如果有分页参数，则执行分页查询
    if (pageParam && limitParam) {
      const page = parseInt(pageParam, 10);
      const limit = parseInt(limitParam, 10);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('roles')
        .select(`
          *,
          role_permissions(count),
          profiles(count)
        `, { count: 'exact' });

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data: roles, error, count } = await query
        .order('created_at', { ascending: true })
        .range(from, to);
      
      if (error) throw error;

      const responseData: RoleWithCounts[] = roles?.map((role: any) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        created_at: role.created_at,
        permission_count: role.role_permissions[0]?.count || 0,
        user_count: role.profiles[0]?.count || 0,
      })) || [];

      return NextResponse.json<ApiResponse<RoleWithCounts[]> & { total: number }>(
        { success: true, data: responseData, total: count ?? 0 }
      );
    }
    
    // 否则，获取所有角色（用于下拉列表等场景）
    const { data: roles, error } = await supabase
      .from('roles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching roles:', error);
      return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to fetch roles' }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Role[]>>({ success: true, data: roles || [] });

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/roles:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
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
    // 验证管理员权限
    const { isAdmin, error: authError } = await verifyAdminUser();
    if (!isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateRoleInput = await request.json();
    const { name, description } = body;

    // 基础验证
    if (!name) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Role name is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // 检查角色名是否已存在
    const { data: existingRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', name)
      .single();

    if (existingRole) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Role name already exists' },
        { status: 400 }
      );
    }

    // 创建角色
    const { data: newRole, error: createError } = await supabase
      .from('roles')
      .insert({
        name,
        description,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating role:', createError);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to create role' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<Role>>(
      { 
        success: true, 
        message: 'Role created successfully',
        data: newRole
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Unexpected error in POST /api/admin/roles:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 