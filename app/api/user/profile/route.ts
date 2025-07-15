import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createSupabaseAdminClient } from "@/lib/supabase"
import { UpdateUserInput } from '@/types/supabase'

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      )
    }
    const userId = (session.user as any).id

    const updateData: UpdateUserInput = await request.json()
    
    if (!updateData || Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '更新数据不能为空' },
        { status: 400 }
      )
    }

    const allowedFields: (keyof UpdateUserInput)[] = [
      'full_name', 
      'username', 
      'id_number',
    ]
    
    const updatePayload: Partial<UpdateUserInput> = {}
    allowedFields.forEach(field => {
      // Ensure we don't assign undefined to the payload
      if (updateData[field] !== undefined) {
        (updatePayload as any)[field] = updateData[field]
      }
    })

    // Do not allow updating avatar_url directly through this endpoint
    // It should be handled by the avatar upload endpoint.
    // Also, ensure there's something to update.
    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: '没有提供有效字段进行更新' },
        { status: 400 }
      )
    }

    const finalPayload = {
      ...updatePayload,
      updated_at: new Date().toISOString()
    }

    const supabaseAdmin = createSupabaseAdminClient()

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(finalPayload)
      .eq('id', userId)
      .select(`
        id,
        email,
        username,
        full_name,
        avatar_url,
        id_number,
        role:roles(id, name)
      `)
      .single()

    if (error) {
      console.error('Update profile error:', error)
      
      if (error.code === '23505') { // unique_violation for username
        return NextResponse.json(
          { error: '用户名已被使用，请选择其他用户名' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: '更新失败，请重试' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: '个人信息更新成功'
    })

  } catch (error) {
    console.error('Profile update API error:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
} 