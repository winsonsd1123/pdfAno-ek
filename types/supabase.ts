// ======================================================================
// Supabase 数据库类型定义
// ======================================================================
// 
// 这个文件定义了与 Supabase 数据库表对应的 TypeScript 类型
// 提供强类型支持，确保数据一致性
// 
// ======================================================================

/**
 * 用户角色表类型
 */
export interface Role {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface RoleWithCounts extends Role {
  permission_count: number;
  user_count: number;
}

/**
 * 用户个人资料表类型
 */
export interface Profile {
  id: string; // UUID，对应 auth.users.id
  email: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  id_number: string | null; // 学号或工号
  role_id: number | null;
  updated_at: string;
}

/**
 * 权限表类型
 */
export interface Permission {
  id: number;
  action: string; // 'create', 'read', 'update', 'delete', 'manage'
  subject: string; // 'document', 'user', 'role', 'all'
  description: string | null;
}

/**
 * 角色权限关联表类型
 */
export interface RolePermission {
  role_id: number;
  permission_id: number;
}

/**
 * 完整的用户信息类型（包含角色信息）
 */
export interface UserWithRole extends Profile {
  role: Role | null;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

/**
 * 用户认证状态类型
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
 * API 响应的通用格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 分页查询参数
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 分页响应数据
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
 * 用户创建/更新的输入类型
 */
export interface CreateUserInput {
  email: string;
  password: string;
  username?: string;
  full_name?: string;
  id_number?: string;
  role_id?: number;
}

export interface UpdateUserInput {
  username?: string;
  full_name?: string;
  id_number?: string;
  role_id?: number;
  avatar_url?: string;
}

/**
 * 角色创建/更新的输入类型
 */
export type CreateRoleInput = Pick<Role, 'name' | 'description'>;
export type UpdateRoleInput = Partial<CreateRoleInput>;

/**
 * 权限检查的结果类型
 */
export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
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

export enum PermissionAction {
  MANAGE = 'manage', // 管理 (all permissions)
  CREATE = 'create', // 创建
  READ = 'read',   // 读取
  UPDATE = 'update', // 更新
  DELETE = 'delete'  // 删除
}

export enum PermissionSubject {
  DOCUMENTS = 'documents',
  USERS = 'users',
  ROLES = 'roles',
  PERMISSIONS = 'permissions',
}

/**
 * 预定义角色名称
 */
export enum RoleName {
  ADMIN = 'admin',
  USER = 'user',
}

/**
 * Supabase 客户端配置类型
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
} 