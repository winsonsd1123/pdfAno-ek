export interface DocumentMetadata {
  id: string
  name: string
  url: string
  size: number
  uploadTime: string
  blobPath: string
}

export interface UploadResponse {
  success: boolean
  document?: DocumentMetadata
  error?: string
}

export interface DeleteResponse {
  success: boolean
  error?: string
} 