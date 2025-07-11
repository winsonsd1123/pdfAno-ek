import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { UpdateUserInput } from '@/types/supabase'

export async function PUT(request: NextRequest) {
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
    const updateData: UpdateUserInput = await request.json()
    
    // 验证必要的字段
    if (!updateData || Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '更新数据不能为空' },
        { status: 400 }
      )
    }

    // 构建更新数据，只包含允许更新的字段
    const allowedFields: (keyof UpdateUserInput)[] = [
      'full_name', 
      'username', 
      'id_number', 
      'avatar_url'
    ]
    
    const updatePayload: any = {}
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    // 添加更新时间
    const finalPayload = {
      ...updatePayload,
      updated_at: new Date().toISOString()
    }

    // 更新用户资料
    const { data, error } = await supabase
      .from('profiles')
      .update(finalPayload)
      .eq('id', user.id)
      .select(`
        id,
        email,
        username,
        full_name,
        avatar_url,
        id_number,
        role_id,
        updated_at,
        role:roles(id, name, description)
      `)
      .single()

    if (error) {
      console.error('Update profile error:', error)
      
      // 处理特定的数据库错误
      if (error.code === '23505') { // 唯一约束违反
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