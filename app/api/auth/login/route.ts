import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required'
      }, { status: 400 });
    }

    // 使用服务端客户端进行登录
    const supabase = await createSupabaseServerClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json({
        success: false,
        error: error?.message || 'Login failed'
      }, { status: 401 });
    }

    // 获取用户profile信息
    const adminClient = createSupabaseAdminClient();
    const { data: profile } = await adminClient
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
      .eq('id', data.user.id)
      .single();

    // 构造返回的用户数据
    const userWithRole = profile ? {
      ...profile,
      role: profile.role ? {
        ...profile.role,
        permissions: profile.role.permissions?.map((rp: any) => rp.permission) || [],
      } : null,
    } : null;

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at
      },
      profile: userWithRole,
      session: data.session
    });

  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 