"use client"

import React from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CreateRoleInput, UpdateRoleInput } from "@/types/supabase"

/**
 * 角色表单模式
 */
export type RoleFormMode = 'create' | 'edit'

/**
 * 角色表单数据
 */
export interface RoleFormData {
  name: string
  description?: string
}

/**
 * RoleForm 组件属性
 */
export interface RoleFormProps {
  mode: RoleFormMode
  initialData?: Partial<RoleFormData>
  loading?: boolean
  onSubmit: (data: CreateRoleInput | UpdateRoleInput) => void | Promise<void>
  onCancel?: () => void
  className?: string
}

/**
 * 角色表单组件
 * 
 * 特性：
 * - 创建/编辑模式
 * - 基础表单验证
 * - 清洁的UI设计
 */
export function RoleForm({
  mode,
  initialData = {},
  loading = false,
  onSubmit,
  onCancel,
  className,
}: RoleFormProps) {
  const [formData, setFormData] = React.useState<RoleFormData>({
    name: initialData.name || "",
    description: initialData.description || "",
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const isCreateMode = mode === 'create'

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = '角色名称不能为空'
    } else if (formData.name.length < 2) {
      newErrors.name = '角色名称至少2个字符'
    } else if (formData.name.length > 50) {
      newErrors.name = '角色名称不能超过50个字符'
    }

    if (formData.description && formData.description.length > 200) {
      newErrors.description = '角色描述不能超过200个字符'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      const submitData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
      }
      
      await onSubmit(submitData)
    } catch (error) {
      console.error('Form submission failed:', error)
    }
  }

  // 处理输入变化
  const handleInputChange = (field: keyof RoleFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // 清除相关错误
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  return (
    <Card className={cn("w-full max-w-lg", className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5" />
          <span>{isCreateMode ? '创建角色' : '编辑角色'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 角色名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">角色名称 *</Label>
            <Input
              id="name"
              type="text"
              placeholder="输入角色名称"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={cn(errors.name && "border-destructive")}
              disabled={loading}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* 角色描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">角色描述</Label>
            <Textarea
              id="description"
              placeholder="描述角色的职责和权限..."
              rows={3}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={cn(errors.description && "border-destructive")}
              disabled={loading}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formData.description?.length || 0}/200 字符
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-3 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                取消
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={loading || !formData.name.trim()}
              className="min-w-[100px]"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isCreateMode ? '创建中...' : '保存中...'}</span>
                </div>
              ) : (
                isCreateMode ? '创建角色' : '保存更改'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
} 