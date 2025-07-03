import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { DeleteResponse } from '@/types/document'

export async function DELETE(request: NextRequest): Promise<NextResponse<DeleteResponse>> {
  try {
    const { blobPath } = await request.json()

    if (!blobPath) {
      return NextResponse.json({
        success: false,
        error: 'Blob path is required'
      }, { status: 400 })
    }

    // 从Vercel Blob删除文件
    await del(blobPath)

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({
      success: false,
      error: 'Delete failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 })
  }
} 