// ======================================================================
// 修改密码 API - /api/setting/change-password
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { UserService } from '@/services/userService';
import { ApiResponse, ChangePasswordDto } from '@/models';

const userService = new UserService();

export async function POST(request: NextRequest) {
  try {
    // 获取当前用户会话
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !(session.user as any).id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '未授权访问'
      }, { status: 401 });
    }

    // 从会话中获取用户信息
    const userId = (session.user as any).id;
    const userEmail = session.user.email;

    // 解析请求体
    const { currentPassword, newPassword }: ChangePasswordDto = await request.json();

    // 调用服务层处理密码修改
    await userService.changePassword({
      userId,
      email: userEmail,
      currentPassword,
      newPassword
    });

    // 返回成功响应
    return NextResponse.json<ApiResponse>({
      success: true,
      message: '密码修改成功'
    });

  } catch (error: any) {
    console.error('Change password API error:', error);
    
    // 返回错误响应
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error.message || '服务器内部错误'
    }, { status: error.message ? 400 : 500 });
  }
}
