// ======================================================================
// 权限数据访问层
// ======================================================================

import { createSupabaseAdminClient } from '@/lib/server/supabase';
import { PermissionDto } from '@/models/permission';

export class PermissionRepository {
  private supabase = createSupabaseAdminClient();

  /**
   * 获取所有权限列表
   */
  async findAll(): Promise<PermissionDto[]> {
    const { data, error } = await this.supabase
      .from('permissions')
      .select('*')
      .order('subject')
      .order('action');

    if (error) throw error;
    return data;
  }

  /**
   * 根据ID获取单个权限
   */
  async findById(id: number): Promise<PermissionDto | null> {
    const { data, error } = await this.supabase
      .from('permissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * 获取指定角色的所有权限
   */
  async findByRoleId(roleId: number): Promise<PermissionDto[]> {
    const { data, error } = await this.supabase
      .from('role_permissions')
      .select(`
        permissions (
          id,
          action,
          subject,
          description
        )
      `)
      .eq('role_id', roleId);

    if (error) throw error;

    // 提取嵌套的permissions对象
    return data.map(row => row.permissions) as PermissionDto[];
  }

  /**
   * 检查权限是否存在
   */
  async exists(id: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('permissions')
      .select('id')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false;
      throw error;
    }

    return true;
  }

  /**
   * 批量检查权限是否都存在
   */
  async validatePermissionIds(ids: number[]): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('permissions')
      .select('id')
      .in('id', ids);

    if (error) throw error;
    return data.length === ids.length;
  }
}
