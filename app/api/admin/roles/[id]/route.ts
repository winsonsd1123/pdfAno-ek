import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { verifyAdminUser } from '@/lib/supabase-server';
import type { 
  ApiResponse, 
  UpdateRoleInput,
} from '@/types/supabase';

/**
 * PUT /api/admin/roles/[id]
 * 更新角色信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAdmin, error: authError } = await verifyAdminUser();
    if (!isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const roleId = parseInt(params.id, 10);
    if (isNaN(roleId)) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Role ID' }, { status: 400 });
    }

    const body: UpdateRoleInput = await request.json();
    const { name, description } = body;

    const supabase = createSupabaseAdminClient();

    // 如果要更新角色名，检查是否重复
    if (name) {
      const { data: existingRole, error: findError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', name)
        .neq('id', roleId)
        .single();

      if (findError && findError.code !== 'PGRST116') { // 'PGRST116' is "exact one row not found", which is good here
        throw findError;
      }
      
      if (existingRole) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Role name already exists' },
          { status: 409 } // 409 Conflict is more appropriate
        );
      }
    }

    // 更新角色
    const { data: updatedData, error: updateError } = await supabase
      .from('roles')
      .update({ name, description })
      .eq('id', roleId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating role:', updateError);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to update role' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({ 
      success: true, 
      message: 'Role updated successfully',
      data: updatedData,
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/admin/roles/[id]:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/roles/[id]
 * 删除角色
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isAdmin, error: authError } = await verifyAdminUser();
    if (!isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const roleId = parseInt(params.id, 10);
    if (isNaN(roleId)) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Role ID' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // 检查角色是否存在及是否为内置角色
    const { data: role, error: findError } = await supabase
      .from('roles')
      .select('name')
      .eq('id', roleId)
      .single();

    if (findError) {
        if (findError.code === 'PGRST116') {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Role not found' }, { status: 404 });
        }
        throw findError;
    }

    if (role.name === 'admin' || role.name === 'user') {
      return NextResponse.json<ApiResponse>({ success: false, error: `System role "${role.name}" cannot be deleted.` }, { status: 403 });
    }

    // 检查是否有用户关联到这个角色
    const { count: userCount, error: userCountError } = await supabase
      .from('user_roles')
      .select('user_id', { count: 'exact', head: true })
      .eq('role_id', roleId);

    if (userCountError) {
        throw userCountError;
    }
    
    if (userCount && userCount > 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Cannot delete role, it is still assigned to ${userCount} user(s).` },
        { status: 409 } // 409 Conflict
      );
    }

    // 删除角色权限关联
    const { error: permissionsError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);
    
    if (permissionsError) {
      throw permissionsError;
    }

    // 删除角色
    const { error: deleteError } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json<ApiResponse>({ success: true, message: 'Role deleted successfully' });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/admin/roles/[id]:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 