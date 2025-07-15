// ======================================================================
// 角色权限详情 API - /api/admin/roles/[id]/permissions
// ======================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import type { ApiResponse, RoleWithPermissions } from '@/types/supabase';

/**
 * GET /api/admin/roles/[id]/permissions
 * 获取单个角色及其完整的权限列表
 */
export async function GET(
  request: NextRequest, // Changed to NextRequest for consistency
  context: { params: { id:string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== 'admin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    const roleId = parseInt(context.params.id, 10);
    if (isNaN(roleId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid role ID' },
        { status: 400 }
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
    console.error('Unexpected error in GET /api/admin/roles/[id]/permissions:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 