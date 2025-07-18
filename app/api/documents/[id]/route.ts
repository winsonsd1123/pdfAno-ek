import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { DocumentRepository } from "@/dal/documentRepository"

interface RouteParams {
  params: {
    id: string
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // 验证用户是否登录
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const documentId = await Promise.resolve(params.id)

  if (!documentId) {
    return NextResponse.json({
      error: 'Document ID is required'
    }, { status: 400 })
  }

  try {
    // 获取文档信息
    const documentRepo = new DocumentRepository()
    const document = await documentRepo.findById(documentId)

    // 验证文档是否存在
    if (!document) {
      return NextResponse.json({
        error: 'Document not found'
      }, { status: 404 })
    }

    // 验证用户是否有权限删除
    if (document.uploader_id !== userId) {
      return NextResponse.json({
        error: 'You do not have permission to delete this document'
      }, { status: 403 })
    }

    // 删除文档
    await documentRepo.remove(documentId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to delete document'
    }, { status: 500 })
  }
} 