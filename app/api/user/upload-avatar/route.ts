import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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

    // 解析上传的文件
    const formData = await request.formData()
    const file = formData.get('avatar') as File
    
    if (!file) {
      return NextResponse.json(
        { error: '请选择要上传的文件' },
        { status: 400 }
      )
    }

    // 验证文件类型
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: '只支持 JPG、PNG、WebP 格式的图片' },
        { status: 400 }
      )
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件大小不能超过 2MB' },
        { status: 400 }
      )
    }

    // 生成文件名：userId + 时间戳 + 文件扩展名
    const fileExtension = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExtension}`
    const filePath = `avatars/${fileName}`

    // 获取文件数据
    const fileBuffer = await file.arrayBuffer()

    // 使用admin客户端检查和创建avatars bucket
    const adminClient = createSupabaseAdminClient()
    const { data: buckets } = await adminClient.storage.listBuckets()
    const avatarBucket = buckets?.find(bucket => bucket.name === 'avatars')
    
    if (!avatarBucket) {
      // 如果bucket不存在，尝试创建
      const { error: createBucketError } = await adminClient.storage.createBucket('avatars', {
        public: true,
        allowedMimeTypes: ALLOWED_FILE_TYPES,
        fileSizeLimit: MAX_FILE_SIZE
      })
      
      if (createBucketError) {
        console.error('Create bucket error:', createBucketError)
        return NextResponse.json(
          { error: '存储服务配置失败：' + createBucketError.message },
          { status: 500 }
        )
      }
    }

    // 获取用户当前头像路径（用于删除旧头像）
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()

    // 使用admin客户端上传新头像（绕过RLS限制）
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('avatars')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false // 不覆盖已存在的文件
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: '文件上传失败，请重试' },
        { status: 500 }
      )
    }

    // 获取公共访问URL
    const { data: publicUrlData } = adminClient.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const avatarUrl = publicUrlData.publicUrl

    // 更新用户资料
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })
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

          if (updateError) {
        console.error('Profile update error:', updateError)
        // 如果更新失败，删除已上传的文件
        await adminClient.storage.from('avatars').remove([filePath])
        return NextResponse.json(
          { error: '头像更新失败，请重试' },
          { status: 500 }
        )
      }

    // 删除旧头像（如果存在且不是默认头像）
    if (currentProfile?.avatar_url && currentProfile.avatar_url.includes('/avatars/')) {
              try {
          const oldFilePath = currentProfile.avatar_url.split('/avatars/')[1]
          if (oldFilePath && oldFilePath !== fileName) {
            await adminClient.storage.from('avatars').remove([`avatars/${oldFilePath}`])
          }
        } catch (error) {
        // 删除旧文件失败不影响主流程
        console.warn('Failed to delete old avatar:', error)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        avatar_url: avatarUrl,
        profile: updatedProfile
      },
      message: '头像上传成功'
    })

  } catch (error) {
    console.error('Upload avatar API error:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
} 