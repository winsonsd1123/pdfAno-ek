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
import type { RoleWithCounts, Permission, CreateRoleInput, UpdateRoleInput, RoleWithPermissions } from "@/types/supabase"

/**
 * 角色管理页面组件
 */
export default function RolesPage() {
  const { toast } = useToast()
  const { showConfirm, ConfirmDialog } = useConfirmDialog()

  // 状态管理
  const [roles, setRoles] = React.useState<RoleWithCounts[]>([])
  const [permissions, setPermissions] = React.useState<Permission[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedRoles, setSelectedRoles] = React.useState<RoleWithCounts[]>([])
  const [showRoleForm, setShowRoleForm] = React.useState(false)
  const [editingRole, setEditingRole] = React.useState<RoleWithCounts | null>(null)
  const [showPermissionDialog, setShowPermissionDialog] = React.useState(false)
  const [configuringRole, setConfiguringRole] = React.useState<RoleWithPermissions | null>(null)
  const [editingPermissions, setEditingPermissions] = React.useState<number[]>([])
  const [searchTerm, setSearchTerm] = React.useState('')
  const [filters, setFilters] = React.useState({})
  const [pagination, setPagination] = React.useState<PaginationConfig>({
    page: 1,
    limit: 10,
    total: 0,
  })

  // 筛选字段配置
  const filterFields: FilterField[] = [
    { key: 'created_date', label: '创建时间', type: 'date-range' }
  ]

  // 加载核心数据
  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchTerm,
        ...filters
      })

      const [rolesResponse, permissionsResponse] = await Promise.all([
        fetch(`/api/admin/roles?${params}`),
        fetch('/api/admin/permissions')
      ])

      if (!rolesResponse.ok || !permissionsResponse.ok) throw new Error('Failed to fetch data')

      const rolesData = await rolesResponse.json()
      const permissionsData = await permissionsResponse.json()

      setRoles(rolesData.data || [])
      setPagination(prev => ({ ...prev, total: rolesData.total || 0 }))
      setPermissions(permissionsData.data || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast({ title: "加载失败", description: "无法加载角色数据，请稍后重试", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, searchTerm, filters, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // 打开权限配置弹窗
  const openPermissionDialog = async (role: RoleWithCounts) => {
    try {
      const res = await fetch(`/api/admin/get-role-permissions?roleId=${role.id}`)
      const result = await res.json()
      if (result.success) {
        setConfiguringRole(result.data)
        setEditingPermissions(result.data.permissions.map((p: Permission) => p.id))
        setShowPermissionDialog(true)
      } else {
        throw new Error(result.error || 'Failed to fetch permissions')
      }
    } catch (error: any) {
      toast({ title: "获取权限失败", description: error.message, variant: "destructive" })
    }
  }
  
  // 保存权限配置
  const handleSavePermissions = async () => {
    if (!configuringRole) return
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/update-role-permissions?roleId=${configuringRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission_ids: editingPermissions }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to save permissions')
      toast({ title: "权限已更新", description: `角色 "${configuringRole.name}" 的权限已成功保存。` })
      setShowPermissionDialog(false)
      fetchData()
    } catch (error: any) {
      toast({ title: "保存失败", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // 表格列配置
  const columns: DataTableColumn<RoleWithCounts>[] = [
    {
      key: 'name',
      title: '角色名称',
      sortable: true,
      render: (_, role) => (
        <div>
          <div className="font-medium">{role.name}</div>
          <div className="text-sm text-muted-foreground">{role.description}</div>
        </div>
      )
    },
    { key: 'permission_count', title: '权限数量', render: (count) => <Badge variant="secondary">{count} 个权限</Badge> },
    { key: 'user_count', title: '用户数量', render: (count) => <span>{count}</span> },
    { key: 'created_at', title: '创建时间', sortable: true, render: (value) => new Date(value).toLocaleDateString('zh-CN') },
    {
      key: 'actions',
      title: '操作',
      width: '120px',
      render: (_, role) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openPermissionDialog(role)}><Eye className="mr-2 h-4 w-4" />查看/配置权限</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEditRole(role)}><Edit className="mr-2 h-4 w-4" />编辑角色</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleDeleteRole(role)} className="text-destructive" disabled={role.name === 'admin' || role.name === 'user'}><Trash2 className="mr-2 h-4 w-4" />删除角色</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ]
  
  // Handlers
  const handleSearch = (value: string) => { setSearchTerm(value); setPagination(p => ({ ...p, page: 1 })); }
  const handleFilterChange = (newFilters: any) => { setFilters(newFilters); setPagination(p => ({ ...p, page: 1 })); }
  const handlePaginationChange = (page: number, limit: number) => setPagination({ ...pagination, page, limit })
  const handleSelectionChange = (selectedRows: RoleWithCounts[]) => setSelectedRoles(selectedRows)
  const handleCreateRole = () => { setEditingRole(null); setShowRoleForm(true); }
  const handleEditRole = (role: RoleWithCounts) => { setEditingRole(role); setShowRoleForm(true); }
  const handleDeleteRole = (role: RoleWithCounts) => {
    if (role.user_count > 0) {
      toast({ title: "无法删除", description: `角色 "${role.name}" 尚有关联用户，请先移除用户。`, variant: "destructive" });
      return;
    }
    showConfirm({
      title: '确认删除角色',
      description: `您确定要删除角色 "${role.name}" 吗？此操作不可逆。`,
      onConfirm: async () => {
        const response = await fetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' });
        if (response.ok) {
          toast({ title: "删除成功", description: `角色 "${role.name}" 已被删除。` });
          fetchData();
        } else {
          const result = await response.json();
          toast({ title: "删除失败", description: result.error, variant: "destructive" });
        }
      },
    });
  }
  const handleRoleFormSubmit = async (data: CreateRoleInput | UpdateRoleInput) => {
    const isEditing = !!editingRole
    const url = isEditing ? `/api/admin/roles/${editingRole!.id}` : '/api/admin/roles'
    const method = isEditing ? 'PUT' : 'POST'
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEditing ? { id: editingRole!.id, ...data } : data),
    })
    const result = await response.json()
    if (response.ok) {
      toast({ title: isEditing ? "更新成功" : "创建成功", description: `角色 "${data.name}" 已${isEditing ? '更新' : '创建'}。` })
      setShowRoleForm(false)
      fetchData()
    } else {
      toast({ title: isEditing ? "更新失败" : "创建失败", description: result.error, variant: "destructive" })
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>角色管理</CardTitle>
            <Button onClick={handleCreateRole} size="sm"><Plus className="mr-2 h-4 w-4" />创建角色</Button>
          </div>
        </CardHeader>
        <CardContent>
          <SearchFilter
            searchValue={searchTerm}
            onSearchChange={handleSearch}
            fields={filterFields}
            filters={filters}
            onFiltersChange={handleFilterChange}
          />
          <DataTable
            columns={columns}
            data={roles}
            loading={loading}
            selectable
            onSelectionChange={handleSelectionChange}
            pagination={pagination}
            onPaginationChange={handlePaginationChange}
          />
        </CardContent>
      </Card>
      <Dialog open={showRoleForm} onOpenChange={setShowRoleForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRole ? '编辑角色' : '创建新角色'}</DialogTitle></DialogHeader>
          <RoleForm
            mode={editingRole ? 'edit' : 'create'}
            initialData={editingRole ? { ...editingRole, description: editingRole.description || '' } : {}}
            onSubmit={handleRoleFormSubmit}
            onCancel={() => setShowRoleForm(false)}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>配置权限 - {configuringRole?.name}</DialogTitle></DialogHeader>
          {configuringRole && (
            <PermissionMatrix
              permissions={permissions}
              selectedPermissions={editingPermissions}
              onPermissionsChange={setEditingPermissions}
              onSave={handleSavePermissions}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  )
} 