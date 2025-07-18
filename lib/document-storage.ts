import { DocumentMetadata } from '@/types/document'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'

const STORAGE_KEY = 'uploaded-documents'
const SESSION_KEY = 'session-documents'

export interface UploadRequestResponse {
  uploadUrl: string
  blobUrl: string
}

export class DocumentStorage {
  static getDocuments(): DocumentMetadata[] {
    if (typeof window === 'undefined') return []
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error reading documents from localStorage:', error)
      return []
    }
  }

  static addDocument(document: DocumentMetadata): void {
    if (typeof window === 'undefined') return
    
    try {
      const documents = this.getDocuments()
      documents.unshift(document) // 新文档添加到开头
      localStorage.setItem(STORAGE_KEY, JSON.stringify(documents))
    } catch (error) {
      console.error('Error saving document to localStorage:', error)
    }
  }

  static removeDocument(id: string): void {
    if (typeof window === 'undefined') return
    
    try {
      const documents = this.getDocuments()
      const filtered = documents.filter(doc => doc.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    } catch (error) {
      console.error('Error removing document from localStorage:', error)
    }
  }

  static getDocument(id: string): DocumentMetadata | null {
    const documents = this.getDocuments()
    return documents.find(doc => doc.id === id) || null
  }

  static clearAll(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing documents from localStorage:', error)
    }
  }

  static getTotalSize(): number {
    const documents = this.getDocuments()
    return documents.reduce((total, doc) => total + doc.size, 0)
  }

  static getCount(): number {
    return this.getDocuments().length
  }

  static getSessionDocuments(): DocumentMetadata[] {
    if (typeof window === 'undefined') return []
    
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error reading documents from sessionStorage:', error)
      return []
    }
  }

  static addSessionDocument(document: DocumentMetadata): void {
    if (typeof window === 'undefined') return
    
    try {
      const documents = this.getSessionDocuments()
      documents.unshift(document) // 新文档添加到开头
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(documents))
    } catch (error) {
      console.error('Error saving document to sessionStorage:', error)
    }
  }

  static removeSessionDocument(id: string): void {
    if (typeof window === 'undefined') return
    
    try {
      const documents = this.getSessionDocuments()
      const filtered = documents.filter(doc => doc.id !== id)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(filtered))
    } catch (error) {
      console.error('Error removing document from sessionStorage:', error)
    }
  }

  static clearSessionDocuments(): void {
    if (typeof window === 'undefined') return
    
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch (error) {
      console.error('Error clearing session documents:', error)
    }
  }

  static getSessionTotalSize(): number {
    const documents = this.getSessionDocuments()
    return documents.reduce((total, doc) => total + doc.size, 0)
  }

  static getSessionCount(): number {
    return this.getSessionDocuments().length
  }

  /**
   * 生成预签名上传URL
   * @param filename 文件名
   * @param contentType 文件类型 (e.g., 'application/pdf')
   * @returns 预签名URL和最终的blob URL
   */
  static async generatePresignedUploadUrl(filename: string, contentType: string): Promise<{
    uploadUrl: string;  // 用于上传的预签名URL
    blobUrl: string;   // 上传完成后的文件访问URL
  }> {
    // 检查文件类型
    if (contentType !== 'application/pdf') {
      throw new Error('Only PDF files are allowed')
    }

    // 生成唯一的文件名
    const uniqueFilename = `${filename.split('.')[0]}_${Date.now()}.pdf`

    try {
      // 调用Vercel Blob的handleUpload来生成预签名URL
      const { url: uploadUrl, blob: { url: blobUrl } } = await handleUpload({
        filename: uniqueFilename,
        contentType,
        // 这里可以添加其他配置，比如maxSize等
        options: {
          access: 'public',
          addRandomSuffix: false,
        }
      })

      return {
        uploadUrl,
        blobUrl
      }
    } catch (error) {
      throw new Error(`Failed to generate upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

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
