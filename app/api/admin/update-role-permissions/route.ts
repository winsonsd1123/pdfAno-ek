// ======================================================================
// 更新角色权限 API - /api/admin/update-role-permissions
// ======================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { verifyAdminUser } from '@/lib/supabase-server';
import type { ApiResponse } from '@/types/supabase';

/**
 * PUT /api/admin/update-role-permissions?roleId=[id]
 * 更新角色的权限
 */
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleIdStr = searchParams.get('roleId');

    if (!roleIdStr) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'roleId is required' }, { status: 400 });
    }

    const roleId = parseInt(roleIdStr, 10);
    if (isNaN(roleId)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid role ID' }, { status: 400 });
    }

    const { isAdmin, error: authError } = await verifyAdminUser();
    if (!isAdmin) {
      return NextResponse.json<ApiResponse>({ success: false, error: authError || 'Unauthorized' }, { status: 401 });
    }

    const { permission_ids } = await request.json();
    if (!Array.isArray(permission_ids)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid input: permission_ids must be an array' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // 使用事务确保数据一致性
    const { error: transactionError } = await supabase.rpc('update_role_permissions', {
      p_role_id: roleId,
      p_permission_ids: permission_ids
    });

    if (transactionError) {
      throw transactionError;
    }

    return NextResponse.json<ApiResponse<{ success: true }>>({ success: true });

  } catch (error: any) {
    console.error(`Error updating permissions for role:`, error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to update permissions' }, { status: 500 });
  }
}

/**
 * Note: This implementation assumes you have a PostgreSQL function (RPC) 
 * named `update_role_permissions` in your Supabase database.
 * This function should handle the transaction of deleting old permissions
 * and inserting new ones atomically.
 *
 * Example function in SQL:
 *
 * CREATE OR REPLACE FUNCTION update_role_permissions(p_role_id INT, p_permission_ids INT[])
 * RETURNS void AS $$
 * BEGIN
 *   -- First, delete existing permissions for the role
 *   DELETE FROM public.role_permissions WHERE role_id = p_role_id;
 *
 *   -- Then, insert the new permissions if the array is not empty
 *   IF array_length(p_permission_ids, 1) > 0 THEN
 *     INSERT INTO public.role_permissions (role_id, permission_id)
 *     SELECT p_role_id, unnest(p_permission_ids);
 *   END IF;
 * END;
 * $$ LANGUAGE plpgsql;
 *
 */ 