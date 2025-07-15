import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createSupabaseAdminClient } from "@/lib/supabase"

interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email || !(session.user as any).id) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      )
    }
    const userId = (session.user as any).id
    const userEmail = session.user.email

    const { currentPassword, newPassword }: ChangePasswordRequest = await request.json()
    
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

    const supabaseAdmin = createSupabaseAdminClient()

    // Step 1: Verify the current password by trying to sign in.
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword
    })

    if (signInError) {
      return NextResponse.json(
        { error: '当前密码不正确' },
        { status: 400 }
      )
    }

    // Step 2: Update the password for the user using their ID.
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json(
        { error: '密码更新失败，请重试' },
        { status: 500 }
      )
    }

    // Step 3: Update the 'updated_at' timestamp in the user's profile.
    await supabaseAdmin
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', userId)

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