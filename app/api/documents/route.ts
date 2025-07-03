import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET() {
  try {
    // 从 Vercel Blob Storage 获取所有 blob 文件
    const { blobs } = await list()
    
    // 过滤出 PDF 文件并转换为我们的文档格式
    const documents = blobs
      .filter(blob => blob.pathname.toLowerCase().endsWith('.pdf'))
      .map(blob => {
        const fileName = blob.pathname.split('/').pop() || ''
        const fileNameWithoutExt = fileName.replace(/\.pdf$/i, '')
        return {
          id: `${blob.uploadedAt}_${fileNameWithoutExt}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
          name: decodeURIComponent(fileName),
          url: blob.url,
          size: blob.size,
          uploadTime: blob.uploadedAt,
          blobPath: blob.pathname
        }
      })
      .sort((a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime()) // 按上传时间倒序

    return NextResponse.json({
      success: true,
      documents
    })
  } catch (error) {
    console.error('Error fetching documents from blob storage:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取文档列表失败' 
      },
      { status: 500 }
    )
  }
} 