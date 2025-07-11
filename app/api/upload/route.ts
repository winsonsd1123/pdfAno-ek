import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
// import { type TablesInsert } from '@/types/supabase' //  暂时注释掉，因为类型文件里可能没有

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

    // 1. 文件重命名逻辑，确保文件名在存储中唯一
    const originalFilename = file.name
    const fileExtension = originalFilename.split('.').pop()
    // 防止文件名中本身包含 "."
    const filenameWithoutExt = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename
    const uniqueFilename = `${filenameWithoutExt}_${Date.now()}.${fileExtension}`

    // 2. 上传文件到 Vercel Blob (使用新文件名)
    const blob = await put(uniqueFilename, file, {
      access: 'public',
      addRandomSuffix: false, // 我们已经手动保证唯一性了
    })

    // 3. 将元数据写入 Supabase (name 字段使用原始文件名)
    const articleData: any = { // 使用 any 类型临时绕过类型检查
      name: originalFilename, // 存原始文件名，方便阅读
      url: blob.url,          // 存真实的、重命名后的文件URL
      uploader_id: user.id,
      status: 'DRAFT', // 按照PRD，初始状态为草稿
    }
    
    const { data: newArticle, error: insertError } = await supabase
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
