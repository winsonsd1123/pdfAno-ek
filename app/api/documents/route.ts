import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 查询当前用户作为上传者或审阅者的所有论文
    // 这取代了之前需要在数据库层面配置的 RLS 策略，将权限控制放在了应用层
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*, uploader:profiles!articles_uploader_id_fkey(full_name), reviewer:profiles!articles_reviewer_id_fkey(full_name)')
      .or(`uploader_id.eq.${user.id},reviewer_id.eq.${user.id}`)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching articles:', error)
      return NextResponse.json({ error: 'Failed to fetch articles.' }, { status: 500 })
    }

    return NextResponse.json(articles)

  } catch (error) {
    console.error('Unexpected error fetching articles:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `An unexpected error occurred: ${errorMessage}` }, { status: 500 })
  }
}
