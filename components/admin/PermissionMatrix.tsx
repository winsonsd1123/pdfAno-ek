"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, Shield, Save, RotateCcw } from "lucide-react"
import { cn } from "@/lib/client/utils"
import { PermissionDto, PermissionAction, PermissionSubject } from "@/models/permission"

/**
 * 权限矩阵数据结构
 */
export interface PermissionMatrix {
  [subject: string]: {
    [action: string]: boolean
  }
}

/**
 * PermissionMatrix 组件属性
 */
export interface PermissionMatrixProps {
  permissions?: PermissionDto[]
  selectedPermissions?: number[]
  onPermissionsChange?: (permissionIds: number[]) => void
  loading?: boolean
  readOnly?: boolean
  onSave?: () => void | Promise<void>
  onReset?: () => void
  className?: string
  title?: string
  description?: string
}

/**
 * 权限矩阵组件
 * 
 * 特性：
 * - 表格形式展示权限
 * - 按主体和动作分组
 * - 支持批量操作
 * - 实时权限统计
 */
export function PermissionMatrix({
  permissions = [],
  selectedPermissions = [],
  onPermissionsChange,
  loading = false,
  readOnly = false,
  onSave,
  onReset,
  className,
  title = "权限配置",
  description = "勾选对应权限以分配给当前角色",
}: PermissionMatrixProps) {
  // 权限动作和主体的映射
  const actionLabels: Record<PermissionAction, string> = {
    [PermissionAction.CREATE]: '创建',
    [PermissionAction.READ]: '查看',
    [PermissionAction.UPDATE]: '编辑',
    [PermissionAction.DELETE]: '删除',
    [PermissionAction.MANAGE]: '管理',
  }

  const subjectLabels: Record<string, string> = {
    [PermissionSubject.ALL]: '所有资源',
    [PermissionSubject.DOCUMENTS]: '文档',
    [PermissionSubject.USERS]: '用户',
    [PermissionSubject.ROLES]: '角色',
    [PermissionSubject.PERMISSIONS]: '权限',
  }

  // 按主体分组权限
  const groupedPermissions = React.useMemo(() => {
    const groups: Record<string, PermissionDto[]> = {}
    
    permissions.forEach(permission => {
      const subject = permission.subject
      if (!groups[subject]) {
        groups[subject] = []
      }
      groups[subject].push(permission)
    })

    // 排序：all 在前，其他按字母顺序
    const sortedSubjects = Object.keys(groups).sort((a, b) => {
      if (a === 'all') return -1
      if (b === 'all') return 1
      return a.localeCompare(b)
    })

    const sortedGroups: Record<string, PermissionDto[]> = {}
    sortedSubjects.forEach(subject => {
      // 按动作排序
      sortedGroups[subject] = groups[subject].sort((a, b) => {
        const actionOrder = ['read', 'create', 'update', 'delete', 'manage']
        const aIndex = actionOrder.indexOf(a.action)
        const bIndex = actionOrder.indexOf(b.action)
        return (aIndex !== -1 ? aIndex : 999) - (bIndex !== -1 ? bIndex : 999)
      })
    })

    return sortedGroups
  }, [permissions])

  // 获取所有动作类型
  const allActions = React.useMemo(() => {
    const actions = new Set<string>()
    permissions.forEach(p => actions.add(p.action))
    return Array.from(actions).sort((a, b) => {
      const actionOrder = ['read', 'create', 'update', 'delete', 'manage']
      const aIndex = actionOrder.indexOf(a)
      const bIndex = actionOrder.indexOf(b)
      return (aIndex !== -1 ? aIndex : 999) - (bIndex !== -1 ? bIndex : 999)
    })
  }, [permissions])

  // 检查权限是否选中
  const isPermissionSelected = (permissionId: number) => {
    return selectedPermissions.includes(permissionId)
  }

  // 检查某个主体的所有权限是否都被选中
  const isSubjectFullySelected = (subject: string) => {
    const subjectPermissions = groupedPermissions[subject] || []
    return subjectPermissions.every(p => isPermissionSelected(p.id))
  }

  // 检查某个动作的所有权限是否都被选中
  const isActionFullySelected = (action: string) => {
    return permissions
      .filter(p => p.action === action)
      .every(p => isPermissionSelected(p.id))
  }

  // 获取指定位置的权限
  const getPermissionByPosition = (subject: string, action: string): PermissionDto | undefined => {
    return groupedPermissions[subject]?.find(p => p.action === action)
  }

  // 处理单个权限变化
  const handlePermissionChange = (permissionId: number, checked: boolean) => {
    if (readOnly) return

    let newSelectedPermissions: number[]
    if (checked) {
      newSelectedPermissions = [...selectedPermissions, permissionId]
    } else {
      newSelectedPermissions = selectedPermissions.filter(id => id !== permissionId)
    }
    
    onPermissionsChange?.(newSelectedPermissions)
  }

  // 处理主体全选/取消全选
  const handleSubjectToggle = (subject: string, checked: boolean) => {
    if (readOnly) return

    const subjectPermissions = groupedPermissions[subject] || []
    const subjectPermissionIds = subjectPermissions.map(p => p.id)
    
    let newSelectedPermissions: number[]
    if (checked) {
      // 添加该主体的所有权限
      newSelectedPermissions = [...new Set([...selectedPermissions, ...subjectPermissionIds])]
    } else {
      // 移除该主体的所有权限
      newSelectedPermissions = selectedPermissions.filter(id => !subjectPermissionIds.includes(id))
    }
    
    onPermissionsChange?.(newSelectedPermissions)
  }

  // 处理动作全选/取消全选
  const handleActionToggle = (action: string, checked: boolean) => {
    if (readOnly) return

    const actionPermissions = permissions.filter(p => p.action === action)
    const actionPermissionIds = actionPermissions.map(p => p.id)
    
    let newSelectedPermissions: number[]
    if (checked) {
      newSelectedPermissions = [...new Set([...selectedPermissions, ...actionPermissionIds])]
    } else {
      newSelectedPermissions = selectedPermissions.filter(id => !actionPermissionIds.includes(id))
    }
    
    onPermissionsChange?.(newSelectedPermissions)
  }

  if (loading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>加载权限数据...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>{title}</span>
            </CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              已选择 {selectedPermissions.length}/{permissions.length} 个权限
            </Badge>
            {!readOnly && (
              <div className="flex items-center space-x-2">
                {onReset && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onReset}
                    disabled={loading}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" />
                    重置
                  </Button>
                )}
                {onSave && (
                  <Button
                    size="sm"
                    onClick={onSave}
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    <Save className="mr-1 h-4 w-4" />
                    保存
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 权限矩阵表格 */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">主体/动作</TableHead>
                {allActions.map(action => (
                  <TableHead key={action} className="text-center">
                    <div className="flex flex-col items-center space-y-1">
                      <span>{actionLabels[action as PermissionAction] || action}</span>
                      {!readOnly && (
                        <Checkbox
                          checked={isActionFullySelected(action)}
                          onCheckedChange={(checked) => handleActionToggle(action, checked as boolean)}
                          className="h-3 w-3"
                        />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedPermissions).map(([subject, subjectPermissions]) => (
                <TableRow key={subject}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">
                        {subjectLabels[subject as string] || subject}
                      </span>
                      {!readOnly && (
                        <Checkbox
                          checked={isSubjectFullySelected(subject)}
                          onCheckedChange={(checked) => handleSubjectToggle(subject, checked as boolean)}
                          className="h-3 w-3"
                        />
                      )}
                    </div>
                  </TableCell>
                  {allActions.map(action => {
                    const permission = getPermissionByPosition(subject, action)
                    return (
                      <TableCell key={action} className="text-center">
                        {permission ? (
                          <div className="flex justify-center">
                            <Checkbox
                              checked={isPermissionSelected(permission.id)}
                              onCheckedChange={(checked) => 
                                handlePermissionChange(permission.id, checked as boolean)
                              }
                              disabled={readOnly}
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
} 