import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { getServerUser } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated',
        user: null,
        profile: null,
        roles: null
      });
    }

    const adminClient = createSupabaseAdminClient();

    // 获取用户的 profile 信息
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // 获取用户关联的角色
    let roleInfo = null;
    if (profile?.role_id) {
      const { data: role, error: roleError } = await adminClient
        .from('roles')
        .select('*')
        .eq('id', profile.role_id)
        .single();
      
      roleInfo = { role, roleError };
    }

    // 获取所有角色列表
    const { data: allRoles, error: rolesError } = await adminClient
      .from('roles')
      .select('*');

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      profile: {
        data: profile,
        error: profileError
      },
      userRole: roleInfo,
      allRoles: {
        data: allRoles,
        error: rolesError
      },
      debug: {
        isAdmin: profile?.role_id && roleInfo?.role?.name === 'admin',
        hasProfile: !!profile,
        hasRoleId: !!profile?.role_id,
        roleName: roleInfo?.role?.name
      }
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 