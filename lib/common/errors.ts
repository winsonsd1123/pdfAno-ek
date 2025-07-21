// ======================================================================
// 自定义错误类
// ======================================================================

/**
 * 应用程序基础错误类
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 文件上传特定错误类
 */
export class FileUploadError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'FileUploadError';
  }
} 