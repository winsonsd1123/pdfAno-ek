// ======================================================================
// 用户服务层
// ======================================================================

import { UserRepository } from '@/dal/userRepository';
import { 
  UserWithRole, 
  CreateUserRequest, 
  UpdateUserRequest,
  PaginationParams,
  PaginatedResponse,
} from '@/models';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * 获取用户列表
   */
  async getUsers(params: {
    pagination: PaginationParams;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<UserWithRole>> {
    return this.userRepository.findMany(params);
  }

  /**
   * 获取单个用户信息
   */
  async getUserById(id: string): Promise<UserWithRole | null> {
    return this.userRepository.findById(id);
  }

  /**
   * 创建新用户
   */
  async createUser(input: CreateUserRequest): Promise<{ id: string; email: string }> {
    // 这里可以添加业务逻辑，比如：
    // - 验证用户名是否已存在
    // - 验证邮箱格式
    // - 密码强度检查
    // - 其他业务规则

    return this.userRepository.create(input);
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: string, input: UpdateUserRequest): Promise<void> {
    // 这里可以添加业务逻辑，比如：
    // - 验证用户是否存在
    // - 验证角色是否有效
    // - 其他业务规则

    await this.userRepository.update(id, input);
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<void> {
    // 这里可以添加业务逻辑，比如：
    // - 验证用户是否存在
    // - 检查是否有关联数据需要处理
    // - 其他业务规则

    await this.userRepository.delete(id);
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
    // 这里可以添加业务逻辑，比如：
    // - 验证邮箱格式
    // - 密码强度检查
    // - 用户名合法性检查
    // - 其他业务规则

    await this.userRepository.register(input);
  }

  /**
   * 修改用户密码
   */
  async changePassword(params: {
    userId: string;
    email: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const { userId, email, currentPassword, newPassword } = params;

    // 业务规则校验
    if (!currentPassword || !newPassword) {
      throw new Error('当前密码和新密码都不能为空');
    }

    if (newPassword.length < 6) {
      throw new Error('新密码长度至少需要6位');
    }

    if (currentPassword === newPassword) {
      throw new Error('新密码不能与当前密码相同');
    }

    // 验证当前密码
    const isValid = await this.userRepository.verifyPassword(email, currentPassword);
    if (!isValid) {
      throw new Error('当前密码不正确');
    }

    // 更新密码
    await this.userRepository.updatePassword(userId, newPassword);
  }
}
