import { del } from '@vercel/blob'
import { DocumentRepository } from '@/dal/documentRepository'
import { DocumentListItemDto } from '@/models/document'

export class DocumentService {
  private documentRepository: DocumentRepository

  constructor() {
    this.documentRepository = new DocumentRepository()
  }

  /**
   * 获取用户相关的文档列表
   */
  async getDocumentList(userId: string): Promise<DocumentListItemDto[]> {
    const documents = await this.documentRepository.findManyByUserId(userId)
    
    return documents.map(doc => ({
      id: doc.id,
      file_name: doc.file_name,
      status: doc.status,
      url: doc.url,
      uploaded_at: doc.uploaded_at,
      uploader: {
        id: doc.uploader_id,
        full_name: doc.uploader.full_name
      },
      reviewer: doc.reviewer ? {
        id: doc.reviewer_id!,
        full_name: doc.reviewer.full_name
      } : undefined
    }))
  }

  /**
   * 删除文档（包括数据库记录和物理文件）
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    // 1. 获取文档信息
    const document = await this.documentRepository.findById(documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    // 2. 权限验证
    if (document.uploader_id !== userId) {
      throw new Error('Forbidden: Only uploader can delete the document')
    }

    // 3. 先删除数据库记录
    await this.documentRepository.remove(documentId)

    // 4. 再删除物理文件（即使失败也不影响业务）
    try {
      if (document.url) {
        await del(document.url)
      }
    } catch (error) {
      console.error(`Failed to delete blob file [${document.url}], but database record was deleted.`, error)
    }
  }
} 