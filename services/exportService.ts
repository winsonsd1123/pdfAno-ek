import { head } from '@vercel/blob';
import { DocumentRepository } from '@/dal/documentRepository';
import { ExportRequestDto } from '@/models/export';
import { embedAnnotations } from '@/lib/pdf-annotation-embedder';
import { ApiError } from '@/models/api';

export class ExportService {
  private documentRepository: DocumentRepository;

  constructor() {
    this.documentRepository = new DocumentRepository();
  }

  async exportPdfWithAnnotations(userId: string, request: ExportRequestDto): Promise<Uint8Array> {
    // 1. 授权检查
    const isAuthorized = await this.documentRepository.isUserAuthorizedForArticle(userId, request.articleId);
    if (!isAuthorized) {
      throw new ApiError('Forbidden', 403);
    }

    // 2. 下载原始PDF文件
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new ApiError('Blob storage not configured', 500);
    }

    let existingPdfBytes: ArrayBuffer;
    try {
        const blob = await head(request.filename, {
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        const response = await fetch(blob.url);
        if (!response.ok) {
            throw new ApiError('Failed to fetch PDF from blob storage', 500);
        }
        existingPdfBytes = await response.arrayBuffer();
    } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error('File not found in blob storage:', error);
        throw new ApiError('File not found', 404);
    }

    // 3. 调用PDF处理专家
    const pdfBytes = await embedAnnotations(existingPdfBytes, request.annotations);

    return pdfBytes;
  }
} 