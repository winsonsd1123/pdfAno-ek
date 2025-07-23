// ======================================================================
// 文件上传工具函数
// ======================================================================

import { FileUploadError } from '../common/errors';

interface ValidationOptions {
  maxSize: number;
  allowedTypes: string[];
}

/**
 * 验证上传的文件是否符合要求
 * @param file - 要验证的文件
 * @param options - 验证选项
 * @throws {FileUploadError} - 如果验证失败则抛出错误
 */
export function validateFile(file: File, options: ValidationOptions): void {
  // 1. 检查文件大小
  if (file.size > options.maxSize) {
    throw new FileUploadError(`文件大小不能超过 ${options.maxSize / 1024 / 1024}MB`);
  }

  // 2. 检查文件类型
  if (!options.allowedTypes.includes(file.type)) {
    throw new FileUploadError(`不支持的文件类型。请上传 ${options.allowedTypes.join(', ')} 格式的文件。`);
  }
}
