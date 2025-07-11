// ======================================================================
// 角色权限详情 API (查询参数) - /api/admin/get-role-permissions
// ======================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { verifyAdminUser } from '@/lib/supabase-server';
import type { ApiResponse, RoleWithPermissions } from '@/types/supabase';

/**
 * GET /api/admin/get-role-permissions?roleId=[id]
 * 获取单个角色及其完整的权限列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleIdStr = searchParams.get('roleId');

    if (!roleIdStr) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'roleId is required' },
        { status: 400 }
      );
    }
    
    const roleId = parseInt(roleIdStr, 10);
    if (isNaN(roleId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid role ID' },
        { status: 400 }
      );
    }

    const { isAdmin, error: authError } = await verifyAdminUser();
    if (!isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: role, error } = await supabase
      .from('roles')
      .select(`
        *,
        permissions:role_permissions(
          permission:permissions(*)
        )
      `)
      .eq('id', roleId)
      .single();

    if (error) {
      console.error(`Error fetching permissions for role ${roleId}:`, error);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to fetch role permissions' },
        { status: 500 }
      );
    }

    if (!role) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    const responseData: RoleWithPermissions = {
      ...role,
      permissions: role.permissions?.map((rp: any) => rp.permission).filter(Boolean) || [],
    };

    return NextResponse.json<ApiResponse<RoleWithPermissions>>(
      { success: true, data: responseData }
    );

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/get-role-permissions:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 