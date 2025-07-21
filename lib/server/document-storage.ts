import { DocumentMetadata } from '@/types/document'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'

export class DocumentStorage {
  /**
   * 处理上传请求，生成预签名URL
   */
  static async handleUploadRequest(request: NextRequest): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody

    try {
      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async () => {
          return {
            allowedContentTypes: ['application/pdf'],
            maximumSizeInBytes: 10 * 1024 * 1024, // 10MB
            addRandomSuffix: true
          }
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          // 上传完成后的回调
          // 注意：这个回调在本地开发时不会触发，需要使用类似 ngrok 的工具才能测试
          console.log('文件上传完成:', blob, tokenPayload)
        }
      })

      return NextResponse.json(jsonResponse)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 }
      )
    }
  }

  /**
   * 处理上传完成的通知
   */
  static async handleUploadComplete(request: NextRequest): Promise<NextResponse> {
    const { blobUrl, originalName } = await request.json()

    // TODO: 这里可以添加数据库操作，记录文件信息
    console.log('收到上传完成通知:', { blobUrl, originalName })

    return NextResponse.json({ success: true })
  }
}
