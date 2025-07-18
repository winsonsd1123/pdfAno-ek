// ======================================================================
// 用户注册 API - /api/auth/register
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/userService';
import { ApiResponse } from '@/models';

const userService = new UserService();

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, fullName } = await request.json();

    if (!email || !password) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Email and password are required'
      }, { status: 400 });
    }

    await userService.register({
      email,
      password,
      username,
      fullName
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: '注册成功！您现在可以登录了。'
    });

  } catch (error: any) {
    console.error('Registration API error:', error);
    
    // 处理特定错误
    if (error.message?.includes('already exists')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '该邮箱地址已被注册。'
      }, { status: 400 });
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器内部错误，请稍后重试。'
    }, { status: 500 });
  }
} 