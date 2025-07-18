// ======================================================================
// 用户数据访问层
// ======================================================================

import { createSupabaseAdminClient } from '@/lib/supabase';
import { 
  Profile, 
  UserWithRole, 
  CreateUserRequest, 
  UpdateUserRequest,
  PaginationParams,
  PaginatedResponse,
  TableName
} from '@/models';

export class UserRepository {
  private supabase = createSupabaseAdminClient();

  /**
   * 获取用户列表（支持分页和搜索）
   */
  async findMany(params: {
    pagination: PaginationParams;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<UserWithRole>> {
    const { pagination, search, sortBy = 'updated_at', sortOrder = 'desc' } = params;
    const { page, limit } = pagination;

    // 构建查询
    let query = this.supabase
      .from(TableName.PROFILES)
      .select(`
        *,
        role:roles(*)
      `, { count: 'exact' });

    // 添加搜索条件
    if (search) {
      query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,id_number.ilike.%${search}%`);
    }

    // 添加排序
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // 添加分页
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: profiles, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return {
      data: profiles || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * 根据ID获取用户信息
   */
  async findById(id: string): Promise<UserWithRole | null> {
    const { data, error } = await this.supabase
      .from(TableName.PROFILES)
      .select(`
        *,
        role:roles(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data;
  }

  /**
   * 创建新用户（包括认证用户和个人资料）
   */
  async create(input: CreateUserRequest): Promise<{ id: string; email: string }> {
    const { email, password, username, full_name, id_number, role_id } = input;

    // 创建认证用户
    const { data: authData, error: createUserError } = await this.supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 管理员创建的用户自动确认邮箱
    });

    if (createUserError || !authData.user) {
      throw new Error(createUserError?.message || 'Failed to create user');
    }

    try {
      // 更新 profile 信息
      const { error: profileError } = await this.supabase
        .from(TableName.PROFILES)
        .update({
          username,
          full_name,
          id_number,
          role_id: role_id || 2, // 默认为普通用户角色
          updated_at: new Date().toISOString(),
        })
        .eq('id', authData.user.id);

      if (profileError) {
        // 如果 profile 更新失败，删除已创建的认证用户
        await this.supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error('Failed to create user profile');
      }

      return {
        id: authData.user.id,
        email: authData.user.email!,
      };
    } catch (error) {
      // 确保在出错时清理认证用户
      await this.supabase.auth.admin.deleteUser(authData.user.id);
      throw error;
    }
  }

  /**
   * 更新用户信息
   */
  async update(id: string, input: UpdateUserRequest): Promise<void> {
    const { full_name, id_number, role_id, avatar_url } = input;

    const { error } = await this.supabase
      .from(TableName.PROFILES)
      .update({
        full_name,
        id_number,
        role_id,
        avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  /**
   * 删除用户（包括认证用户和个人资料）
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.auth.admin.deleteUser(id);

    if (error) {
      if (error.message.includes('User not found')) {
        throw new Error('User not found');
      }
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  /**
   * 用户注册
   */
  async register(input: {
    email: string;
    password: string;
    username?: string;
    fullName?: string;
  }): Promise<void> {
    const { email, password, username, fullName } = input;

    // 创建认证用户
    const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Failed to create user');
    }

    try {
      // 创建用户个人资料
      const { error: profileError } = await this.supabase
        .from(TableName.PROFILES)
        .insert({
          id: authData.user.id,
          username: username || email.split('@')[0],
          full_name: fullName,
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        // 如果创建个人资料失败，删除认证用户
        await this.supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error('Failed to create user profile');
      }
    } catch (error) {
      // 确保在出错时清理认证用户
      await this.supabase.auth.admin.deleteUser(authData.user.id);
      throw error;
    }
  }

  /**
   * 验证用户密码
   */
  async verifyPassword(email: string, password: string): Promise<boolean> {
    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    return !error;
  }

  /**
   * 更新用户密码
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    // 更新密码
    const { error: updateError } = await this.supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    // 更新 profile 的时间戳
    const { error: profileError } = await this.supabase
      .from(TableName.PROFILES)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (profileError) {
      throw new Error(`Failed to update profile timestamp: ${profileError.message}`);
    }
  }
} 