import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { email, password, userData } = await request.json();

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required'
      }, { status: 400 });
    }

    // 使用服务端客户端进行注册
    const supabase = await createSupabaseServerClient();
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json({
        success: false,
        error: error?.message || 'Registration failed'
      }, { status: 400 });
    }

    // 如果提供了额外的用户数据，创建或更新 profile
    if (userData && data.user) {
      const adminClient = createSupabaseAdminClient();
      
      const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
          id: data.user.id,
          username: userData.username || email.split('@')[0],
          full_name: userData.full_name,
          id_number: userData.id_number,
          avatar_url: userData.avatar_url,
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // 注册成功但profile创建失败，仍然返回成功
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at
      },
      message: 'Registration successful. Please check your email for verification.'
    });

  } catch (error) {
    console.error('Registration API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 