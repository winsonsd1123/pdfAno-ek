/**
 * 文件上传错误的基类
 */
export class UploadError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'UploadError'
  }
}

/**
 * 文件大小超限错误
 */
export class FileSizeError extends UploadError {
  constructor(public maxSize: number) {
    super(
      `文件大小超过限制，最大支持 ${formatFileSize(maxSize)}`,
      'FILE_TOO_LARGE'
    )
    this.name = 'FileSizeError'
  }
}

/**
 * 文件类型错误
 */
export class FileTypeError extends UploadError {
  constructor(public allowedTypes: string[]) {
    super(
      `不支持的文件类型，仅支持 ${allowedTypes.join(', ')}`,
      'INVALID_TYPE'
    )
    this.name = 'FileTypeError'
  }
}

/**
 * 网络错误
 */
export class NetworkError extends UploadError {
  constructor(message: string) {
    super(
      `网络错误: ${message}`,
      'NETWORK_ERROR'
    )
    this.name = 'NetworkError'
  }
}

/**
 * 认证错误
 */
export class AuthError extends UploadError {
  constructor() {
    super(
      '您需要登录后才能上传文件',
      'UNAUTHORIZED'
    )
    this.name = 'AuthError'
  }
}

/**
 * 服务器错误
 */
export class ServerError extends UploadError {
  constructor(message: string) {
    super(
      `服务器错误: ${message}`,
      'SERVER_ERROR'
    )
    this.name = 'ServerError'
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 验证文件
 */
export function validateFile(file: File, options: { maxSize?: number; allowedTypes?: string[] }) {
  const { maxSize, allowedTypes } = options

  if (maxSize && file.size > maxSize) {
    throw new FileSizeError(maxSize)
  }

  if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    throw new FileTypeError(allowedTypes)
  }
}

/**
 * 处理上传错误
 */
export function handleUploadError(error: unknown): { message: string; variant: 'default' | 'destructive' } {
  if (error instanceof UploadError) {
    // 已知的上传错误类型
    return {
      message: error.message,
      variant: 'destructive'
    }
  } else if (error instanceof Error) {
    // 其他 Error 实例
    return {
      message: `上传失败: ${error.message}`,
      variant: 'destructive'
    }
  } else {
    // 未知错误
    return {
      message: '上传失败，请重试',
      variant: 'destructive'
    }
  }
} 