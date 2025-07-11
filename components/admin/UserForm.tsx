"use client"

import React from 'react'
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Upload, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Role, CreateUserInput, UpdateUserInput } from "@/types/supabase"

/**
 * 用户表单模式
 */
export type UserFormMode = 'create' | 'edit'

/**
 * 用户表单数据验证规则
 */
const baseUserFormSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  username: z.string().min(2, "用户名至少2位字符").optional(),
  full_name: z.string().min(1, "请输入姓名").optional(),
  id_number: z.string().optional(),
  role_id: z.number().optional(),
  avatar_url: z.string().url("请输入有效的头像链接").optional().or(z.literal("")),
})

const createUserFormSchema = baseUserFormSchema.extend({
  password: z.string().min(6, "密码至少6位字符"),
})

const editUserFormSchema = baseUserFormSchema.extend({
  password: z.string().optional(),
})

export type UserFormData = z.infer<typeof createUserFormSchema>

/**
 * UserForm 组件属性
 */
export interface UserFormProps {
  mode: UserFormMode
  initialData?: Partial<UserFormData>
  roles?: Role[]
  loading?: boolean
  onSubmit: (data: CreateUserInput | UpdateUserInput) => void | Promise<void>
  onCancel?: () => void
  className?: string
}

/**
 * 用户表单组件
 * 
 * 特性：
 * - 创建/编辑模式
 * - 表单验证
 * - 角色选择
 * - 头像上传
 */
export function UserForm({
  mode,
  initialData = {},
  roles = [],
  loading = false,
  onSubmit,
  onCancel,
  className,
}: UserFormProps) {
  const [avatarPreview, setAvatarPreview] = React.useState<string>(
    initialData.avatar_url || ""
  )
  const isCreateMode = mode === 'create'

  const form = useForm<UserFormData>({
    resolver: zodResolver(isCreateMode ? createUserFormSchema : editUserFormSchema),
    defaultValues: {
      email: initialData.email || "",
      password: "",
      username: initialData.username || "",
      full_name: initialData.full_name || "",
      id_number: initialData.id_number || "",
      role_id: initialData.role_id || undefined,
      avatar_url: initialData.avatar_url || "",
    },
  })

  // 处理表单提交
  const handleSubmit = async (data: UserFormData) => {
    try {
      if (isCreateMode) {
        const createData: CreateUserInput = {
          email: data.email,
          password: data.password!,
          username: data.username,
          full_name: data.full_name,
          id_number: data.id_number,
          role_id: data.role_id,
        }
        await onSubmit(createData)
      } else {
        const updateData: UpdateUserInput = {
          full_name: data.full_name,
          id_number: data.id_number,
          role_id: data.role_id,
          avatar_url: data.avatar_url,
        }
        await onSubmit(updateData)
      }
    } catch (error) {
      console.error('Form submission failed:', error)
    }
  }

  // 处理头像变化
  const handleAvatarChange = (url: string) => {
    setAvatarPreview(url)
    form.setValue('avatar_url', url)
  }

  // 获取用户名首字母作为头像后备
  const getAvatarFallback = () => {
    const fullName = form.watch('full_name')
    const username = form.watch('username')
    const email = form.watch('email')
    
    if (fullName) return fullName.charAt(0).toUpperCase()
    if (username) return username.charAt(0).toUpperCase()
    if (email) return email.charAt(0).toUpperCase()
    return 'U'
  }

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <User className="h-5 w-5" />
          <span>{isCreateMode ? '创建用户' : '编辑用户'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* 头像部分 */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarPreview} />
                <AvatarFallback className="text-lg font-semibold">
                  {getAvatarFallback()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="avatar_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>头像链接</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <Input
                            placeholder="https://example.com/avatar.jpg"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e)
                              handleAvatarChange(e.target.value)
                            }}
                          />
                          <Button type="button" variant="outline" size="icon">
                            <Upload className="h-4 w-4" />
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱 *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        disabled={!isCreateMode}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isCreateMode && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密码 *</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="至少6位字符"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户名</FormLabel>
                    <FormControl>
                      <Input placeholder="username" {...field} disabled={!isCreateMode} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓名</FormLabel>
                    <FormControl>
                      <Input placeholder="张三" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="id_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>学号/工号</FormLabel>
                    <FormControl>
                      <Input placeholder="202301001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>角色</FormLabel>
                    <Select 
                      value={field.value?.toString()} 
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择角色" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end space-x-3 pt-6">
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
              <Button type="submit" disabled={loading} className="min-w-[100px]">
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{isCreateMode ? '创建中...' : '保存中...'}</span>
                  </div>
                ) : (
                  isCreateMode ? '创建用户' : '保存更改'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
} 