import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { verifyAdminUser } from '@/lib/supabase-server';
import type { 
  ApiResponse, 
  UpdateUserInput,
} from '@/types/supabase';

/**
 * PUT /api/admin/users/[id]
 * 更新用户信息
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
  try {
    // 验证管理员权限
    const { isAdmin, error: authError } = await verifyAdminUser();
    if (!isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!id) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid User ID' }, { status: 400 });
    }

    const body: UpdateUserInput = await request.json();
    const { full_name, id_number, role_id, avatar_url } = body;

    const supabase = createSupabaseAdminClient();

    // 更新 profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name,
        id_number,
        role_id,
        avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to update user' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'User updated successfully' }
    );

  } catch (error) {
    console.error('Unexpected error in PUT /api/admin/users/[id]:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
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
    // 验证管理员权限
    const { isAdmin, error: authError } = await verifyAdminUser();
    if (!isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid User ID' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    
    // 使用 admin 权限删除用户
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(id);

    if (deleteUserError) {
      console.error('Error deleting user:', deleteUserError);
      // 根据错误类型返回不同的响应
      if (deleteUserError.message.includes('User not found')) {
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'User not found' },
            { status: 404 }
        );
      }
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to delete user' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, message: 'User deleted successfully' });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/admin/users/[id]:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 