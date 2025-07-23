// ======================================================================
// API 响应模型定义
// ======================================================================

/**
 * API 通用响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 数据库表名枚举
 */
export enum TableName {
  PROFILES = 'profiles',
  ROLES = 'roles',
  PERMISSIONS = 'permissions',
  ROLE_PERMISSIONS = 'role_permissions',
}
