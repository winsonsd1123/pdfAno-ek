// ======================================================================
// 角色权限详情 API - /api/admin/roles/[id]/permissions
// ======================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { verifyAdminUser } from '@/lib/supabase-server';
import type { ApiResponse, RoleWithPermissions } from '@/types/supabase';

/**
 * GET /api/admin/roles/[id]/permissions
 * 获取单个角色及其完整的权限列表
 */
export async function GET(
  request: Request,
  context: { params: { id:string } }
) {
  console.log("\n\n--- [GET /api/admin/roles/[id]/permissions] ---");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Request URL:", request.url);
  console.log("Request Headers:", JSON.stringify(Object.fromEntries(request.headers), null, 2));
  
  try {
    console.log("Attempting to access context.params.id...");
    const roleId = parseInt(context.params.id, 10);
    console.log("Successfully accessed roleId:", roleId);

    if (isNaN(roleId)) {
      console.error("Error: roleId is NaN");
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
    console.error('Unexpected error in GET /api/admin/roles/[id]/permissions:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 