// ======================================================================
// 角色管理服务
// ======================================================================

import { RoleRepository } from '@/dal/roleRepository';
import { PermissionRepository } from '@/dal/permissionRepository';
import { 
  RoleDto, 
  RoleWithPermissionsDto, 
  RoleWithStatsDto,
  CreateRoleDto,
  UpdateRoleDto,
  UpdateRolePermissionsDto,
  RoleName 
} from '@/models/role';
import { PermissionDto } from '@/models/permission';

export class RoleManagementService {
  private roleRepo: RoleRepository;
  private permissionRepo: PermissionRepository;

  constructor() {
    this.roleRepo = new RoleRepository();
    this.permissionRepo = new PermissionRepository();
  }

  /**
   * 获取所有角色（带权限统计）
   */
  async getAllRoles(): Promise<RoleWithStatsDto[]> {
    return this.roleRepo.findManyWithStats();
  }

  /**
   * 获取单个角色的完整信息（包含权限列表）
   */
  async getRoleById(id: number): Promise<RoleWithPermissionsDto | null> {
    return this.roleRepo.findByIdWithPermissions(id);
  }

  /**
   * 创建新角色
   * @throws {Error} 如果角色名已存在或权限ID无效
   */
  async createRole(data: CreateRoleDto): Promise<RoleDto> {
    // 1. 检查角色名是否已存在
    const isNameTaken = await this.roleRepo.isNameTaken(data.name);
    if (isNameTaken) {
      throw new Error(`角色名 "${data.name}" 已存在`);
    }

    // 2. 如果提供了权限列表，验证所有权限ID是否有效
    if (data.permissions?.length) {
      const arePermissionsValid = await this.permissionRepo.validatePermissionIds(data.permissions);
      if (!arePermissionsValid) {
        throw new Error('存在无效的权限ID');
      }
    }

    // 3. 创建角色
    return this.roleRepo.create(data);
  }

  /**
   * 更新角色基本信息
   * @throws {Error} 如果角色名已被其他角色使用
   */
  async updateRole(id: number, data: UpdateRoleDto): Promise<RoleDto> {
    // 1. 检查角色是否存在
    const role = await this.getRoleById(id);
    if (!role) {
      throw new Error('角色不存在');
    }

    // 2. 如果要更新角色名，检查新名字是否已被使用
    if (data.name && data.name !== role.name) {
      const isNameTaken = await this.roleRepo.isNameTaken(data.name, id);
      if (isNameTaken) {
        throw new Error(`角色名 "${data.name}" 已被使用`);
      }
    }

    // 3. 更新角色
    return this.roleRepo.update(id, data);
  }

  /**
   * 更新角色的权限
   * @throws {Error} 如果角色不存在或权限ID无效
   */
  async updateRolePermissions(roleId: number, data: UpdateRolePermissionsDto): Promise<void> {
    // 1. 检查角色是否存在
    const role = await this.getRoleById(roleId);
    if (!role) {
      throw new Error('角色不存在');
    }

    // 2. 验证所有权限ID是否有效
    const arePermissionsValid = await this.permissionRepo.validatePermissionIds(data.permissions);
    if (!arePermissionsValid) {
      throw new Error('存在无效的权限ID');
    }

    // 3. 更新权限
    await this.roleRepo.updatePermissions(roleId, data.permissions);
  }

  /**
   * 删除角色
   * @throws {Error} 如果是系统预置角色或角色不存在
   */
  async deleteRole(id: number): Promise<void> {
    // 1. 检查角色是否存在
    const role = await this.getRoleById(id);
    if (!role) {
      throw new Error('角色不存在');
    }

    // 2. 禁止删除系统预置角色
    if (role.name === RoleName.ADMIN || role.name === RoleName.USER) {
      throw new Error('系统预置角色不能删除');
    }

    // 3. 删除角色（级联删除权限关联）
    await this.roleRepo.remove(id);
  }

  /**
   * 获取所有可用的权限列表
   */
  async getAllPermissions(): Promise<PermissionDto[]> {
    return this.permissionRepo.findAll();
  }

  /**
   * 获取指定角色的所有权限
   */
  async getRolePermissions(roleId: number): Promise<PermissionDto[]> {
    return this.permissionRepo.findByRoleId(roleId);
  }
}
