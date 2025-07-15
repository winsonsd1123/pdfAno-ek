import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createSupabaseAdminClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id;

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: `File size must be less than ${maxSize / 1024 / 1024}MB` }, { status: 400 })
    }

    const originalFilename = file.name
    const fileExtension = originalFilename.split('.').pop()
    const filenameWithoutExt = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename
    const uniqueFilename = `${filenameWithoutExt}_${Date.now()}.${fileExtension}`

    const blob = await put(uniqueFilename, file, {
      access: 'public',
      addRandomSuffix: false,
    })

    const articleData: any = {
      name: originalFilename,
      url: blob.url,
      uploader_id: userId,
      status: 'DRAFT',
    }
    
    const supabaseAdmin = createSupabaseAdminClient()
    const { data: newArticle, error: insertError } = await supabaseAdmin
      .from('articles')
      .insert(articleData)
      .select()
      .single()

    if (insertError) {
      // 卧槽，这里有个风险：文件已经上传到Vercel了，但数据库写入失败了。
      // 这会导致一个“孤儿”文件。生产环境中需要一个补偿机制，比如后台任务清理这类文件。
      // 但对于MVP，我们先接受这个风险。
      console.error('Supabase insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save article metadata.' }, { status: 500 })
    }

    return NextResponse.json(newArticle)

  } catch (error) {
    console.error('Upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Upload failed: ${errorMessage}` }, { status: 500 })
  }
}
