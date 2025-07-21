import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createSupabaseAdminClient } from '@/lib/server/supabase'
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      )
    }

    const userId = (session.user as any).id;

    const formData = await request.formData()
    const file = formData.get('avatar') as File
    
    if (!file) {
      return NextResponse.json(
        { error: '请选择要上传的文件' },
        { status: 400 }
      )
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: '只支持 JPG、PNG、WebP 格式的图片' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件大小不能超过 2MB' },
        { status: 400 }
      )
    }

    const fileExtension = file.name.split('.').pop()
    const fileName = `${userId}-${Date.now()}.${fileExtension}`
    const filePath = `avatars/${fileName}`
    const fileBuffer = await file.arrayBuffer()

    const adminClient = createSupabaseAdminClient()
    const { data: buckets } = await adminClient.storage.listBuckets()
    const avatarBucket = buckets?.find(bucket => bucket.name === 'avatars')
    
    if (!avatarBucket) {
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

    const { data: currentProfile } = await adminClient
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single()

    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('avatars')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: '文件上传失败，请重试' },
        { status: 500 }
      )
    }

    const { data: publicUrlData } = adminClient.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const avatarUrl = publicUrlData.publicUrl

    const { data: updatedProfile, error: updateError } = await adminClient
      .from('profiles')
      .update({ 
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select() // Select all columns for the updated profile
      .single()

    if (updateError) {
      console.error('Profile update error:', updateError)
      await adminClient.storage.from('avatars').remove([filePath])
      return NextResponse.json(
        { error: '头像更新失败，请重试' },
        { status: 500 }
      )
    }

    if (currentProfile?.avatar_url && currentProfile.avatar_url.includes('/avatars/')) {
      try {
        const oldFilePath = currentProfile.avatar_url.split('/avatars/')[1]
        if (oldFilePath && oldFilePath !== fileName) {
          await adminClient.storage.from('avatars').remove([`avatars/${oldFilePath}`])
        }
      } catch (error) {
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