"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  RoleForm, 
  PermissionMatrix,
  ConfirmDialog,
  useConfirmDialog,
  type DataTableColumn,
  type FilterField,
  type PaginationConfig,
} from "@/components/admin"
import { 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Shield,
  Users,
  Eye
} from "lucide-react"
import { 
  RoleDto,
  RoleWithPermissionsDto,
  RoleWithStatsDto,
  CreateRoleDto,
  UpdateRoleDto,
  UpdateRolePermissionsDto
} from '@/models/role'
import { PermissionDto } from '@/models/permission'
import { ApiResponse } from '@/models/api'

/**
 * 角色管理页面组件
 */
export default function RolesPage() {
  const { toast } = useToast()
  const { showConfirm, ConfirmDialog } = useConfirmDialog()

  // 状态管理
  const [roles, setRoles] = React.useState<RoleWithStatsDto[]>([])
  const [permissions, setPermissions] = React.useState<PermissionDto[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedRoles, setSelectedRoles] = React.useState<RoleWithStatsDto[]>([])
  const [showRoleForm, setShowRoleForm] = React.useState(false)
  const [editingRole, setEditingRole] = React.useState<RoleWithStatsDto | null>(null)
  const [showPermissionDialog, setShowPermissionDialog] = React.useState(false)
  const [configuringRole, setConfiguringRole] = React.useState<RoleWithPermissionsDto | null>(null)
  const [editingPermissions, setEditingPermissions] = React.useState<number[]>([])

  // 加载核心数据
  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true)

      const [rolesResponse, permissionsResponse] = await Promise.all([
        fetch('/api/admin/roles'),
        fetch('/api/admin/permissions')
      ])

      if (!rolesResponse.ok || !permissionsResponse.ok) {
        throw new Error('Failed to fetch data')
      }

      const rolesData = await rolesResponse.json() as ApiResponse<RoleWithStatsDto[]>
      const permissionsData = await permissionsResponse.json() as ApiResponse<PermissionDto[]>

      if (!rolesData.success || !permissionsData.success) {
        throw new Error(rolesData.error || permissionsData.error || '加载数据失败')
      }

      setRoles(rolesData.data ?? [])
      setPermissions(permissionsData.data ?? [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast({ 
        title: "加载失败", 
        description: error instanceof Error ? error.message : "无法加载角色数据，请稍后重试", 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // 打开权限配置弹窗
  const openPermissionDialog = async (role: RoleWithStatsDto) => {
    try {
      const res = await fetch(`/api/admin/roles/${role.id}/permissions`)
      const result = await res.json() as ApiResponse<PermissionDto[]>
      
      if (!result.success || !result.data) {
        throw new Error(result.error || '获取权限失败')
      }

      setConfiguringRole({
        ...role,
        permissions: result.data
      })
      setEditingPermissions(result.data.map(p => p.id))
      setShowPermissionDialog(true)
    } catch (error) {
      toast({ 
        title: "获取权限失败", 
        description: error instanceof Error ? error.message : "无法加载权限数据",
        variant: "destructive" 
      })
    }
  }
  
  // 保存权限配置
  const handleSavePermissions = async () => {
    if (!configuringRole) return
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/roles/${configuringRole.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: editingPermissions } as UpdateRolePermissionsDto),
      })
      const result = await response.json() as ApiResponse<void>
      
      if (!result.success) {
        throw new Error(result.error || '保存权限失败')
      }

      toast({ 
        title: "权限已更新", 
        description: `角色 "${configuringRole.name}" 的权限已成功保存。` 
      })
      setShowPermissionDialog(false)
      fetchData()
    } catch (error) {
      toast({ 
        title: "保存失败", 
        description: error instanceof Error ? error.message : "无法保存权限配置",
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  // 处理角色表单提交
  const handleRoleFormSubmit = async (data: CreateRoleDto | UpdateRoleDto) => {
    try {
      setLoading(true)
      const isEditing = !!editingRole

      const response = await fetch(
        isEditing ? `/api/admin/roles/${editingRole.id}` : '/api/admin/roles',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )

      const result = await response.json() as ApiResponse<RoleDto>
      
      if (!result.success || !result.data) {
        throw new Error(result.error || '操作失败')
      }

      toast({ 
        title: isEditing ? "角色已更新" : "角色已创建",
        description: `角色 "${result.data.name}" ${isEditing ? '更新成功' : '创建成功'}。`
      })
      setShowRoleForm(false)
      setEditingRole(null)
      fetchData()
    } catch (error) {
      toast({ 
        title: "操作失败", 
        description: error instanceof Error ? error.message : "无法完成操作",
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  // 处理删除角色
  const handleDeleteRole = (role: RoleWithStatsDto) => {
    if (role.user_count > 0) {
      toast({ 
        title: "无法删除", 
        description: `角色 "${role.name}" 尚有 ${role.user_count} 个关联用户，请先移除用户。`,
        variant: "destructive" 
      })
      return
    }

    showConfirm({
      title: '确认删除角色',
      description: `您确定要删除角色 "${role.name}" 吗？此操作不可逆。`,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/admin/roles/${role.id}`, { 
            method: 'DELETE' 
          })
          const result = await response.json() as ApiResponse<void>
          
          if (!result.success) {
            throw new Error(result.error || '删除失败')
          }

          toast({ 
            title: "删除成功", 
            description: `角色 "${role.name}" 已被删除。` 
          })
          fetchData()
        } catch (error) {
          toast({ 
            title: "删除失败", 
            description: error instanceof Error ? error.message : "无法删除角色",
            variant: "destructive" 
          })
        }
      },
    })
  }

  // 表格列配置
  const columns: DataTableColumn<RoleWithStatsDto>[] = [
    {
      key: 'name',
      title: '角色名称',
      render: (_, role) => (
        <div>
          <div className="font-medium">{role.name}</div>
          <div className="text-sm text-muted-foreground">{role.description}</div>
        </div>
      )
    },
    { 
      key: 'permission_count', 
      title: '权限数量', 
      render: (count) => <Badge variant="secondary">{count} 个权限</Badge> 
    },
    { 
      key: 'user_count', 
      title: '用户数量', 
      render: (count) => <span>{count}</span> 
    },
    { 
      key: 'created_at', 
      title: '创建时间', 
      render: (value) => new Date(value).toLocaleDateString('zh-CN') 
    },
    {
      key: 'actions',
      title: '操作',
      width: '120px',
      render: (_, role) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openPermissionDialog(role)}>
              <Eye className="mr-2 h-4 w-4" />查看/配置权限
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEditingRole(role); setShowRoleForm(true); }}>
              <Edit className="mr-2 h-4 w-4" />编辑角色
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleDeleteRole(role)} 
              className="text-destructive" 
              disabled={role.name === 'admin' || role.name === 'user'}
            >
              <Trash2 className="mr-2 h-4 w-4" />删除角色
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ]

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>角色管理</CardTitle>
            <Button onClick={() => { setEditingRole(null); setShowRoleForm(true); }} size="sm">
              <Plus className="mr-2 h-4 w-4" />创建角色
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={roles}
            loading={loading}
            selectable
            onSelectionChange={setSelectedRoles}
          />
        </CardContent>
      </Card>

      {/* 角色表单弹窗 */}
      <Dialog open={showRoleForm} onOpenChange={setShowRoleForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? '编辑角色' : '创建新角色'}</DialogTitle>
          </DialogHeader>
          <RoleForm
            mode={editingRole ? 'edit' : 'create'}
            initialData={editingRole ? {
              name: editingRole.name,
              description: editingRole.description ?? ''
            } : {}}
            onSubmit={handleRoleFormSubmit}
            onCancel={() => { setShowRoleForm(false); setEditingRole(null); }}
            loading={loading}
          />
        </DialogContent>
      </Dialog>

      {/* 权限配置弹窗 */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>配置权限 - {configuringRole?.name}</DialogTitle>
          </DialogHeader>
          {configuringRole && (
            <PermissionMatrix
              permissions={permissions}
              selectedPermissions={editingPermissions}
              onPermissionsChange={setEditingPermissions}
              onSave={handleSavePermissions}
              loading={loading}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 确认对话框 */}
      <ConfirmDialog />
    </div>
  )
} 