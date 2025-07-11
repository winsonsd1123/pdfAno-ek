import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      )
    }

    // 解析请求体
    const { currentPassword, newPassword }: ChangePasswordRequest = await request.json()
    
    // 验证输入
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '当前密码和新密码都不能为空' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: '新密码长度至少需要6位' },
        { status: 400 }
      )
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: '新密码不能与当前密码相同' },
        { status: 400 }
      )
    }

    // 首先验证当前密码
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    })

    if (signInError || !signInData.user) {
      return NextResponse.json(
        { error: '当前密码不正确' },
        { status: 400 }
      )
    }

    // 更新密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json(
        { error: '密码更新失败，请重试' },
        { status: 500 }
      )
    }

    // 更新用户资料的更新时间
    await supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', user.id)

    return NextResponse.json({
      success: true,
      message: '密码修改成功'
    })

  } catch (error) {
    console.error('Change password API error:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
} 