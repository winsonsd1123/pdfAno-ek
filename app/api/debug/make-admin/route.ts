import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { getServerUser } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    const adminClient = createSupabaseAdminClient();

    // 1. 确保 admin 角色存在
    let { data: adminRole, error: roleError } = await adminClient
      .from('roles')
      .select('*')
      .eq('name', 'admin')
      .single();

    if (roleError || !adminRole) {
      // 创建 admin 角色
      const { data: newRole, error: createRoleError } = await adminClient
        .from('roles')
        .insert({
          name: 'admin',
          description: '系统管理员'
        })
        .select()
        .single();

      if (createRoleError) {
        return NextResponse.json({
          success: false,
          error: 'Failed to create admin role',
          details: createRoleError
        }, { status: 500 });
      }

      adminRole = newRole;
    }

    // 2. 检查用户的 profile 是否存在
    let { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // 创建 profile
      const { data: newProfile, error: createProfileError } = await adminClient
        .from('profiles')
        .insert({
          id: user.id,
          username: user.email?.split('@')[0] || 'admin',
          full_name: 'Administrator',
          role_id: adminRole.id,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createProfileError) {
        return NextResponse.json({
          success: false,
          error: 'Failed to create profile',
          details: createProfileError
        }, { status: 500 });
      }

      profile = newProfile;
    } else {
      // 更新现有 profile 的角色
      const { error: updateError } = await adminClient
        .from('profiles')
        .update({
          role_id: adminRole.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: 'Failed to update profile role',
          details: updateError
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully assigned admin role',
      user: {
        id: user.id,
        email: user.email
      },
      profile: profile,
      adminRole: adminRole
    });

  } catch (error) {
    console.error('Make admin API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 