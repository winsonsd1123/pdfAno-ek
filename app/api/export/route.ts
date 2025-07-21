import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { ExportRequestDto } from '@/models/export'
import { ExportService } from '@/services/exportService'
import { ApiError } from '@/models/api'

export async function POST(request: NextRequest) {
  try {
    // 1. 会话验证
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未登录或会话已过期' }, { status: 401 })
    }
    const userId = (session.user as any).id
    if (!userId) {
      return NextResponse.json({ error: '无效的用户会话' }, { status: 401 })
    }

    // 2. 请求体验证
    const body: ExportRequestDto = await request.json()
    if (!body.filename || !body.annotations || !Array.isArray(body.annotations)) {
      return NextResponse.json({ error: '无效的请求体：缺少必要字段' }, { status: 400 })
    }
    if (!body.articleId) {
      return NextResponse.json({ error: '无效的请求体：缺少 articleId' }, { status: 400 })
    }

    // 3. 导出处理
    const exportService = new ExportService();
    const pdfBytes = await exportService.exportPdfWithAnnotations(userId, body);

    // 4. 返回响应
    const headers = new Headers()
    headers.set('Content-Type', 'application/pdf')
    
    // 生成导出文件名：annotation-YYYYMMDD-HHMMSS.pdf
    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    const exportFilename = `easyanno-${timestamp}.pdf`
    
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(exportFilename)}"`)

    return new NextResponse(pdfBytes, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('导出PDF时发生错误:', error)
    
    // 处理已知的业务错误
    if (error instanceof ApiError) {
      const statusCode = error.statusCode || 500
      const message = error.message || '导出失败'
      return NextResponse.json({ error: message }, { status: statusCode })
    }

    // 处理未知错误
    console.error('导出PDF时发生未知错误:', error)
    return NextResponse.json(
      { error: '导出PDF时发生错误，请稍后重试' }, 
      { status: 500 }
    )
  }
}
