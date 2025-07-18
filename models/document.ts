import { ApiResponse } from './api'

// 文档列表项的数据传输对象
export interface DocumentListItemDto {
  id: string
  status: string
  url: string
  uploaded_at: string
  uploader: {
    id: string
    full_name: string
  }
  reviewer?: {
    id: string
    full_name: string
  }
}

// 数据库查询返回的原始文档类型
export interface DocumentEntity {
  id: string
  status: string
  url: string
  uploaded_at: string
  uploader_id: string
  reviewer_id?: string
  uploader: {
    full_name: string
  }
  reviewer?: {
    full_name: string
  }
}

// API 响应类型
export type DocumentListResponse = ApiResponse<DocumentListItemDto[]>
export type DocumentDeleteResponse = ApiResponse<{ message: string }> 