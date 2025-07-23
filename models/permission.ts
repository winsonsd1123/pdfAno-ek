// ======================================================================
// 权限相关的数据传输对象 (DTOs) 和类型定义
// ======================================================================

/**
 * 权限基础信息
 */
export interface PermissionDto {
  id: number;
  action: PermissionAction;
  subject: PermissionSubject;
  description: string | null;
}

/**
 * 权限动作枚举
 */
export enum PermissionAction {
  MANAGE = 'manage', // 管理 (all permissions)
  CREATE = 'create', // 创建
  READ = 'read',   // 读取
  UPDATE = 'update', // 更新
  DELETE = 'delete'  // 删除
}

/**
 * 权限主体枚举
 */
export enum PermissionSubject {
  ALL = 'all',        // 所有资源
  DOCUMENTS = 'documents',
  USERS = 'users',
  ROLES = 'roles',
  PERMISSIONS = 'permissions',
}

/**
 * 角色权限关联
 */
export interface RolePermissionDto {
  role_id: number;
  permission_id: number;
  created_at: string;
}

/**
 * 权限检查结果
 */
export interface PermissionCheckDto {
  hasPermission: boolean;
  reason?: string;
}
