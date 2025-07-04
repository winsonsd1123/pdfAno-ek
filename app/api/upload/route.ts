import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { DocumentMetadata, UploadResponse } from '@/types/document'

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 })
    }

    // 验证文件类型
    if (file.type !== 'application/pdf') {
      return NextResponse.json({
        success: false,
        error: 'Only PDF files are allowed'
      }, { status: 400 })
    }

    // 验证文件大小 (4.5MB限制)
    const maxSize = 4.5 * 1024 * 1024 // 4.5MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: 'File size must be less than 4.5MB'
      }, { status: 400 })
    }

    // 上传到Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: false, // 保持原文件名
    })

    // 创建文档元数据
    const document: DocumentMetadata = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      url: blob.url,
      size: file.size,
      uploadTime: new Date().toISOString(),
      blobPath: blob.pathname,
    }

    return NextResponse.json({
      success: true,
      document
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({
      success: false,
      error: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 })
  }
}
