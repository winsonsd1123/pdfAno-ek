import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { DocumentStorage } from "@/lib/server/document-storage"

export async function POST(request: NextRequest) {
  // 验证用户是否登录
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return DocumentStorage.handleUploadRequest(request)
} 