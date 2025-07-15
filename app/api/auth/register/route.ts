import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, fullName } = await request.json();

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required'
      }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    
    // Step 1: Create the user in Supabase Auth using the admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm user's email
    });

    if (authError || !authData.user) {
      // Handle potential error, e.g., user already exists
      const errorMessage = authError?.message.includes('unique constraint')
        ? '该邮箱地址已被注册。'
        : (authError?.message || '创建用户时发生错误。');
      
      return NextResponse.json({
        success: false,
        error: errorMessage
      }, { status: 400 });
    }

    const user = authData.user;

    // Step 2: Create a corresponding profile in the 'profiles' table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user.id,
        username: username || email.split('@')[0],
        full_name: fullName,
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('Error creating profile for new user:', profileError);
      // This is a critical error. If the profile isn't created, the user might not be able to log in
      // because our NextAuth `authorize` function requires a profile to exist.
      // We should probably delete the user we just created to avoid an inconsistent state.
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      
      return NextResponse.json({
        success: false,
        error: '创建用户配置信息时失败，请重试。'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '注册成功！您现在可以登录了。'
    });

  } catch (error) {
    console.error('Registration API error:', error);
    return NextResponse.json({
      success: false,
      error: '服务器内部错误，请稍后重试。'
    }, { status: 500 });
  }
} 