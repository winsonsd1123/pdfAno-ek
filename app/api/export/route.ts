import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { ExportRequestDto } from '@/models/export'
import { ExportService } from '@/services/exportService'
import { ApiError } from '@/models/api'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id;

  try {
    const requestData: ExportRequestDto = await request.json()
    
    if (!requestData.filename || !requestData.annotations || !requestData.articleId) {
      return NextResponse.json({ error: 'Missing filename, articleId, or annotations' }, { status: 400 })
    }

    const exportService = new ExportService();
    const pdfBytes = await exportService.exportPdfWithAnnotations(userId, requestData);

    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const exportFilename = `export_${timestamp}.pdf`;
    
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportFilename}"`,
      },
    })

  } catch (error) {
    console.error('Export error:', error)
    if (error instanceof ApiError) {
        return NextResponse.json({ 
            error: error.message, 
        }, { status: error.statusCode })
    }
    return NextResponse.json({ 
      error: 'Failed to export PDF', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
