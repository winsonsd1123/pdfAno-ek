// ======================================================================
// 角色相关的数据传输对象 (DTOs) 和类型定义
// ======================================================================

import { PermissionDto } from './permission';

/**
 * 角色基础信息
 */
export interface RoleDto {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

/**
 * 带权限的角色信息
 */
export interface RoleWithPermissionsDto extends RoleDto {
  permissions: PermissionDto[];
}

/**
 * 带统计信息的角色
 */
export interface RoleWithStatsDto extends RoleDto {
  permission_count: number;
  user_count: number;
}

/**
 * 创建角色的请求体
 */
export interface CreateRoleDto {
  name: string;
  description?: string;
  permissions?: number[]; // 可选的初始权限ID列表
}

/**
 * 更新角色的请求体
 */
export interface UpdateRoleDto {
  name?: string;
  description?: string;
}

/**
 * 更新角色权限的请求体
 */
export interface UpdateRolePermissionsDto {
  permissions: number[]; // 权限ID列表，将完全替换现有权限
}

/**
 * 预定义角色名称
 */
export enum RoleName {
  ADMIN = 'admin',
  USER = 'user',
} 