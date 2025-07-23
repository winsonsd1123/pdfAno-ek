// ======================================================================
// 角色数据访问层
// ======================================================================

import { createSupabaseAdminClient } from '@/lib/server/supabase';
import { RoleDto, RoleWithPermissionsDto, RoleWithStatsDto, CreateRoleDto, UpdateRoleDto } from '@/models/role';
import { PermissionDto } from '@/models/permission';

export class RoleRepository {
  private supabase = createSupabaseAdminClient();

  /**
   * 获取所有角色列表（带权限和统计信息）
   */
  async findManyWithStats(): Promise<RoleWithStatsDto[]> {
    const { data, error } = await this.supabase
      .from('roles')
      .select(`
        *,
        permission_count:role_permissions(count),
        user_count:profiles(count)
      `);

    if (error) throw error;

    return data.map(role => ({
      ...role,
      permission_count: role.permission_count[0]?.count ?? 0,
      user_count: role.user_count[0]?.count ?? 0
    }));
  }

  /**
   * 获取单个角色及其所有权限
   */
  async findByIdWithPermissions(id: number): Promise<RoleWithPermissionsDto | null> {
    const { data, error } = await this.supabase
      .from('roles')
      .select(`
        *,
        permissions:role_permissions(
          permission:permissions(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // 记录不存在
      throw error;
    }

    // 转换嵌套数据结构
    return {
      ...data,
      permissions: data.permissions.map((rp: any) => rp.permission)
    };
  }

  /**
   * 创建新角色
   */
  async create(data: CreateRoleDto): Promise<RoleDto> {
    // 1. 创建角色基本信息
    const { data: role, error: roleError } = await this.supabase
      .from('roles')
      .insert({
        name: data.name,
        description: data.description
      })
      .select()
      .single();

    if (roleError) throw roleError;

    // 2. 如果提供了权限列表，创建角色-权限关联
    if (data.permissions?.length) {
      const rolePermissions = data.permissions.map(permissionId => ({
        role_id: role.id,
        permission_id: permissionId
      }));

      const { error: permError } = await this.supabase
        .from('role_permissions')
        .insert(rolePermissions);

      if (permError) throw permError;
    }

    return role;
  }

  /**
   * 更新角色基本信息
   */
  async update(id: number, data: UpdateRoleDto): Promise<RoleDto> {
    const { data: role, error } = await this.supabase
      .from('roles')
      .update({
        name: data.name,
        description: data.description
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return role;
  }

  /**
   * 删除角色（会级联删除角色权限关联）
   */
  async remove(id: number): Promise<void> {
    const { error } = await this.supabase
      .from('roles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * 更新角色的权限列表（替换现有权限）
   */
  async updatePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    // 1. 删除现有权限
    const { error: deleteError } = await this.supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);

    if (deleteError) throw deleteError;

    // 2. 如果有新权限，插入新的权限
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map(permissionId => ({
        role_id: roleId,
        permission_id: permissionId
      }));

      const { error: insertError } = await this.supabase
        .from('role_permissions')
        .insert(rolePermissions);

      if (insertError) throw insertError;
    }
  }

  /**
   * 检查角色名是否已存在
   */
  async isNameTaken(name: string, excludeId?: number): Promise<boolean> {
    const query = this.supabase
      .from('roles')
      .select('id')
      .eq('name', name);

    if (excludeId) {
      query.neq('id', excludeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data.length > 0;
  }
}
