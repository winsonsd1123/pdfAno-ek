"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { 
  DataTable, 
  SearchFilter, 
  UserForm, 
  ConfirmDialog,
  useConfirmDialog,
  type DataTableColumn,
  type FilterField,
  type UserFormData,
} from "@/components/admin"
import { 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  UserX, 
  UserCheck,
  Eye,
  Download,
  Upload
} from "lucide-react"
import type { UserWithRole, Role, CreateUserInput, UpdateUserInput } from "@/types/supabase"

/**
 * 用户状态枚举
 */
enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

/**
 * 用户管理页面组件
 */
export default function UsersPage() {
  const { toast } = useToast()
  const { showConfirm, ConfirmDialog } = useConfirmDialog()

  // 状态管理
  const [users, setUsers] = React.useState<UserWithRole[]>([])
  const [roles, setRoles] = React.useState<Role[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedUsers, setSelectedUsers] = React.useState<UserWithRole[]>([])
  const [showUserForm, setShowUserForm] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<UserWithRole | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [filters, setFilters] = React.useState({
    role_id: '',
    status: '',
    created_date: null
  })
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 20,
    total: 0
  })

  // 筛选字段配置
  const filterFields: FilterField[] = [
    {
      key: 'role_id',
      label: '角色',
      type: 'select',
      options: roles.map(role => ({ value: role.id.toString(), label: role.name }))
    },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      options: [
        { value: UserStatus.ACTIVE, label: '正常' },
        { value: UserStatus.INACTIVE, label: '未激活' },
        { value: UserStatus.SUSPENDED, label: '已禁用' }
      ]
    },
    {
      key: 'created_date',
      label: '注册时间',
      type: 'date-range'
    }
  ]

  // 表格列配置
  const columns: DataTableColumn<UserWithRole>[] = [
    {
      key: 'avatar_url',
      title: '头像',
      width: '60px',
      render: (_, user) => (
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.avatar_url || ''} />
          <AvatarFallback>
            {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
      )
    },
    {
      key: 'full_name',
      title: '姓名',
      sortable: true,
      render: (_, user) => (
        <div>
          <div className="font-medium">{user.full_name || '未设置'}</div>
          <div className="text-sm text-muted-foreground">@{user.username || 'N/A'}</div>
        </div>
      )
    },
    {
      key: 'email',
      title: '邮箱',
      render: (_, user) => (
        <div className="text-sm">{user.email || '-'}</div>
      )
    },
    {
      key: 'id_number',
      title: '学号/工号',
      render: (value) => value || '-'
    },
    {
      key: 'role',
      title: '角色',
      render: (_, user) => (
        user.role ? (
          <Badge variant="secondary">{user.role.name}</Badge>
        ) : (
          <Badge variant="outline">无角色</Badge>
        )
      )
    },
    {
      key: 'updated_at',
      title: '最后更新',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('zh-CN')
    },
    {
      key: 'actions', // 使用一个唯一的 key
      title: '操作',
      width: '100px',
      render: (_, user) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>操作</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleViewUser(user)}>
              <Eye className="mr-2 h-4 w-4" />
              查看详情
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEditUser(user)}>
              <Edit className="mr-2 h-4 w-4" />
              编辑用户
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleToggleUserStatus(user)}>
              {true ? (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  禁用用户
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  启用用户
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleDeleteUser(user)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除用户
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ]

  // 加载数据
  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true)
      
      // 构建查询参数，并过滤掉空值
      const allParams: Record<string, any> = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        ...filters,
      };

      const cleanParams = Object.entries(allParams).reduce((acc, [key, value]) => {
        if (value !== null && value !== '' && value !== undefined) {
          acc[key] = String(value);
        }
        return acc;
      }, {} as Record<string, string>);

      const params = new URLSearchParams(cleanParams);

      const [usersResponse, rolesResponse] = await Promise.all([
        fetch(`/api/admin/users?${params}`),
        fetch('/api/admin/roles')
      ])

      if (!usersResponse.ok) {
        throw new Error(`Failed to fetch users: ${usersResponse.statusText}`)
      }
      if (!rolesResponse.ok) {
        // 角色加载失败不应完全阻塞
        console.error(`Failed to fetch roles: ${rolesResponse.statusText}`)
        toast({
          title: "角色加载失败",
          description: "部分筛选功能可能无法使用",
          variant: "default",
        })
      }

      const usersData = await usersResponse.json()
      const rolesData = await rolesResponse.json()

      if (usersData.success) {
        setUsers(usersData.data?.data || [])
        setPagination(prev => ({ 
          ...prev, 
          total: usersData.data?.pagination?.total || 0,
          totalPages: usersData.data?.pagination?.totalPages || 1,
        }))
      } else {
        throw new Error(usersData.error || 'Failed to parse users data')
      }
      
      if (rolesData.success) {
        setRoles(rolesData.data || [])
      } else {
        console.error('Failed to parse roles data:', rolesData.error)
      }

    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast({
        title: "加载失败",
        description: error instanceof Error ? error.message : "无法加载用户数据，请稍后重试",
        variant: "destructive",
      })
      // 出错时清空用户列表
      setUsers([])
      setPagination(prev => ({ ...prev, total: 0, page: 1, totalPages: 1 }))
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, searchTerm, filters, toast])

  // 初始化加载
  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  // 处理筛选变更
  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  // 处理分页变更
  const handlePaginationChange = (page: number, limit: number) => {
    setPagination(prev => ({ ...prev, page, limit }))
  }

  // 处理选择变化
  const handleSelectionChange = (selectedRows: UserWithRole[]) => {
    setSelectedUsers(selectedRows)
  }

  // 查看用户详情
  const handleViewUser = (user: UserWithRole) => {
    // TODO: 实现用户详情弹窗或跳转
    toast({
      title: "查看用户",
      description: `查看用户 ${user.full_name || user.username} 的详细信息`,
    })
  }

  // 编辑用户
  const handleEditUser = (user: UserWithRole) => {
    setEditingUser(user)
    setShowUserForm(true)
  }

  // 创建用户
  const handleCreateUser = () => {
    setEditingUser(null)
    setShowUserForm(true)
  }

  // 提交用户表单
  const handleUserFormSubmit = async (data: CreateUserInput | UpdateUserInput) => {
    try {
      const isEdit = !!editingUser
      const url = isEdit ? `/api/admin/users/${editingUser.id}` : '/api/admin/users'
      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error('Failed to save user')
      }

      toast({
        title: isEdit ? "用户更新成功" : "用户创建成功",
        description: `用户信息已${isEdit ? '更新' : '创建'}`,
      })

      setShowUserForm(false)
      setEditingUser(null)
      fetchData()
    } catch (error) {
      console.error('Failed to save user:', error)
      toast({
        title: "操作失败",
        description: "保存用户信息失败，请稍后重试",
        variant: "destructive",
      })
    }
  }

  // 切换用户状态
  const handleToggleUserStatus = (user: UserWithRole) => {
    const isActive = true // TODO: 从用户数据中获取实际状态
    
    showConfirm({
      title: isActive ? "禁用用户" : "启用用户",
      description: `确定要${isActive ? '禁用' : '启用'}用户 ${user.full_name || user.username} 吗？`,
      type: isActive ? 'warning' : 'info',
      onConfirm: async () => {
        // TODO: 实现状态切换逻辑
        toast({
          title: `用户已${isActive ? '禁用' : '启用'}`,
          description: `用户 ${user.full_name || user.username} 状态已更新`,
        })
        fetchData()
      }
    })
  }

  // 删除用户
  const handleDeleteUser = (user: UserWithRole) => {
    showConfirm({
      title: "删除用户",
      description: `确定要删除用户 ${user.full_name || user.username} 吗？此操作不可恢复。`,
      type: 'danger',
      confirmText: '删除',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/admin/users/${user.id}`, {
            method: 'DELETE'
          })

          if (!response.ok) {
            throw new Error('Failed to delete user')
          }

          toast({
            title: "用户已删除",
            description: `用户 ${user.full_name || user.username} 已被删除`,
          })
          fetchData()
        } catch (error) {
          console.error('Failed to delete user:', error)
          toast({
            title: "删除失败",
            description: "无法删除用户，请稍后重试",
            variant: "destructive",
          })
        }
      }
    })
  }

  // 批量操作
  const handleBatchDisable = () => {
    if (selectedUsers.length === 0) return

    showConfirm({
      title: "批量禁用用户",
      description: `确定要禁用选中的 ${selectedUsers.length} 个用户吗？`,
      type: 'warning',
      onConfirm: async () => {
        // TODO: 实现批量禁用逻辑
        toast({
          title: "批量操作完成",
          description: `已禁用 ${selectedUsers.length} 个用户`,
        })
        setSelectedUsers([])
        fetchData()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground">
            管理系统用户账户、角色分配和权限设置
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            导入
          </Button>
          <Button onClick={handleCreateUser}>
            <Plus className="mr-2 h-4 w-4" />
            添加用户
          </Button>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <SearchFilter
        searchPlaceholder="搜索用户姓名、邮箱..."
        searchValue={searchTerm}
        onSearchChange={handleSearch}
        fields={filterFields}
        filters={filters}
        onFiltersChange={handleFilterChange}
      />

      {/* 批量操作栏 */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="text-sm text-muted-foreground">
            已选择 {selectedUsers.length} 个用户
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleBatchDisable}>
              <UserX className="mr-2 h-4 w-4" />
              批量禁用
            </Button>
            <Button variant="outline" size="sm">
              分配角色
            </Button>
          </div>
        </div>
      )}

      {/* 用户列表 */}
      <DataTable
        data={users}
        columns={columns}
        loading={loading}
        pagination={pagination}
        onPaginationChange={handlePaginationChange}
        selectable
        selectedRows={selectedUsers}
        onSelectionChange={handleSelectionChange}
      />

      {/* 用户表单弹窗 */}
      {showUserForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] overflow-y-auto">
            <UserForm
              mode={editingUser ? 'edit' : 'create'}
              initialData={editingUser ? {
                email: editingUser.email || '',
                username: editingUser.username || '',
                full_name: editingUser.full_name || '',
                id_number: editingUser.id_number || '',
                role_id: editingUser.role_id || undefined,
                avatar_url: editingUser.avatar_url || ''
              } : {}}
              roles={roles}
              onSubmit={handleUserFormSubmit}
              onCancel={() => {
                setShowUserForm(false)
                setEditingUser(null)
              }}
            />
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      <ConfirmDialog />
    </div>
  )
} 