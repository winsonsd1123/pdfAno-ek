// ======================================================================
// 用户模型定义
// ======================================================================

import { RoleDto } from './role';

/**
 * 用户个人资料
 */
export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  id_number: string | null;
  role_id: number | null;
  updated_at: string;
}

/**
 * 完整的用户信息（包含角色信息）
 */
export interface UserWithRole extends Profile {
  role: RoleDto | null;
}

/**
 * 用户认证信息
 */
export interface AuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 创建用户的请求数据
 */
export interface CreateUserRequest {
  email: string;
  password: string;
  username?: string;
  full_name?: string;
  id_number?: string;
  role_id?: number;
}

/**
 * 更新用户的请求数据
 */
export interface UpdateUserRequest {
  username?: string;
  full_name?: string;
  id_number?: string;
  role_id?: number;
  avatar_url?: string;
}

/**
 * 用户列表查询参数
 */
export interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 修改密码的请求数据
 */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

/**
 * 用户列表响应
 */
export interface UserListResponse {
  data: UserWithRole[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
