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
        profile: null
      }, { status: 401 });
    }

    // 获取用户profile信息
    const adminClient = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select(`
        *,
        role:roles(
          *,
          permissions:role_permissions(
            permission:permissions(*)
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.warn('Error fetching profile:', profileError);
    }

    // 构造返回的用户数据
    const userWithRole = profile ? {
      ...profile,
      role: profile.role ? {
        ...profile.role,
        permissions: profile.role.permissions?.map((rp: any) => rp.permission) || [],
      } : null,
    } : {
      id: user.id,
      username: null,
      full_name: null,
      id_number: null,
      avatar_url: null,
      role_id: null,
      updated_at: new Date().toISOString(),
      role: null,
    };

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      profile: userWithRole
    });

  } catch (error) {
    console.error('Get user API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 