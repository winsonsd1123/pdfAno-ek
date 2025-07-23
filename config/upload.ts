export const UPLOAD_CONFIG = {
  // 文件大小限制：10MB
  maxSize: 10 * 1024 * 1024,
  
  // 允许的文件类型
  allowedTypes: ['application/pdf'] as string[],
  
  // 最大并发上传数
  maxConcurrent: 3,
  
  // 上传重试次数
  maxRetries: 3,
  
  // 重试延迟（毫秒）
  retryDelay: 1000,
  
  // 上传超时时间（毫秒）
  timeout: 30000,
}

// 上传状态类型
export type UploadStatus = 
  | { type: 'idle' }
  | { type: 'validating' }
  | { type: 'uploading'; progress: number }
  | { type: 'success'; url: string }
  | { type: 'error'; message: string }
