import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createSupabaseAdminClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const userId = (session.user as any).id;

  try {
    const supabaseAdmin = createSupabaseAdminClient()
    
    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select('*, uploader:profiles!articles_uploader_id_fkey(full_name), reviewer:profiles!articles_reviewer_id_fkey(full_name)')
      .or(`uploader_id.eq.${userId},reviewer_id.eq.${userId}`)
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
