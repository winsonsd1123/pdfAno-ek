import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { del } from '@vercel/blob'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const articleId = params.id
  if (!articleId) {
    return NextResponse.json({ error: 'Article ID is required' }, { status: 400 })
  }

  try {
    // 1. 从数据库查询文章信息，特别是 url 和上传者 id
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('url, uploader_id')
      .eq('id', articleId)
      .single()

    if (fetchError || !article) {
      return NextResponse.json({ error: 'Article not found.' }, { status: 404 })
    }

    // 2. 权限验证：只有上传者本人才能删除
    if (article.uploader_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. 从 Vercel Blob 删除文件
    // 即使这里失败了，我们也可以继续尝试删除数据库记录，让用户至少能从列表里移除它。
    try {
      await del(article.url)
    } catch (blobError) {
      console.error(`Failed to delete blob file [${article.url}], but proceeding with DB record deletion.`, blobError)
    }

    // 4. 从 Supabase 删除记录
    const { error: deleteError } = await supabase
      .from('articles')
      .delete()
      .eq('id', articleId)

    if (deleteError) {
      console.error('Supabase delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete article from database.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Article deleted successfully.' })

  } catch (error) {
    console.error('Unexpected delete error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `An unexpected error occurred: ${errorMessage}` }, { status: 500 })
  }
} 