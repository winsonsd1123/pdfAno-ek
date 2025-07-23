import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { DocumentRepository } from "@/dal/documentRepository"

export async function POST(request: NextRequest) {
  // 验证用户是否登录
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id

  try {
    const { blobUrl, originalName } = await request.json()

    // 创建文档记录
    const documentRepo = new DocumentRepository()
    await documentRepo.create({
      name: originalName,
      url: blobUrl,
      uploader_id: userId,
      status: 'DRAFT'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('上传完成处理失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
