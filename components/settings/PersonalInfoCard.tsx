"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Icons } from "@/components/ui/icons"
import { useToast } from "@/hooks/use-toast"
import { User, Upload, Save, Edit } from "lucide-react"

export function PersonalInfoCard() {
  const { profile, refreshProfile } = useAuth()
  const { toast } = useToast()
  
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    username: profile?.username || "",
    id_number: profile?.id_number || "",
    avatar_url: profile?.avatar_url || ""
  })

  // 获取用户头像首字母
  const getAvatarFallback = () => {
    if (formData.full_name) return formData.full_name.charAt(0).toUpperCase()
    if (formData.username) return formData.username.charAt(0).toUpperCase()
    if (profile?.email) return profile.email.charAt(0).toUpperCase()
    return 'U'
  }

  // 处理表单输入变化
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 保存个人信息
  const handleSave = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          username: formData.username,
          id_number: formData.id_number,
          avatar_url: formData.avatar_url
        }),
      })

      if (response.ok) {
        await refreshProfile() // 刷新用户资料
        setIsEditing(false)
        toast({
          title: "保存成功",
          description: "个人信息已更新",
        })
      } else {
        const result = await response.json()
        toast({
          variant: "destructive",
          title: "保存失败",
          description: result.error || "未知错误",
        })
      }
    } catch (error) {
      console.error('Save profile error:', error)
      toast({
        variant: "destructive",
        title: "保存失败",
        description: "网络错误，请重试",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 取消编辑
  const handleCancel = () => {
    setFormData({
      full_name: profile?.full_name || "",
      username: profile?.username || "",
      id_number: profile?.id_number || "",
      avatar_url: profile?.avatar_url || ""
    })
    setIsEditing(false)
  }

  // 处理头像上传
  const handleAvatarUpload = async (file: File) => {
    if (!file) return

    // 验证文件类型和大小
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const maxSize = 2 * 1024 * 1024 // 2MB

    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "文件格式不支持",
        description: "请选择 JPG、PNG 或 WebP 格式的图片",
      })
      return
    }

    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "文件过大",
        description: "图片大小不能超过 2MB",
      })
      return
    }

    setIsLoading(true)
    try {
      // 创建FormData
      const formData = new FormData()
      formData.append('avatar', file)

      // 上传头像
      const response = await fetch('/api/user/upload-avatar', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // 更新本地状态
        handleInputChange('avatar_url', result.data.avatar_url)
        
        // 刷新用户资料
        await refreshProfile()
        
        toast({
          title: "头像上传成功",
          description: "您的头像已更新",
        })
      } else {
        toast({
          variant: "destructive",
          title: "上传失败",
          description: result.error || "头像上传失败，请重试",
        })
      }
    } catch (error) {
      console.error('Avatar upload error:', error)
      toast({
        variant: "destructive",
        title: "上传失败",
        description: "网络错误，请重试",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-gray-700" />
            <span>个人信息</span>
          </CardTitle>
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              编辑
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isLoading}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    保存
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 头像部分 */}
        <div className="flex items-center space-x-6">
          <Avatar className="h-20 w-20">
            <AvatarImage src={formData.avatar_url} />
            <AvatarFallback className="text-lg font-semibold bg-gray-100 text-gray-600">
              {getAvatarFallback()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <div>
              <Label className="text-sm font-medium text-gray-700">头像</Label>
              <p className="text-sm text-gray-500">支持 JPG、PNG 格式，文件大小不超过 2MB</p>
            </div>
            {isEditing && (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/jpeg,image/png,image/webp'
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) {
                        handleAvatarUpload(file)
                      }
                    }
                    input.click()
                  }}
                >
                  {isLoading ? (
                    <>
                      <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      上传头像
                    </>
                  )}
                </Button>
                {formData.avatar_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => handleInputChange('avatar_url', '')}
                  >
                    移除头像
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 基本信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="full_name">真实姓名</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              disabled={!isEditing}
              placeholder="请输入真实姓名"
              className={!isEditing ? "bg-gray-50" : ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              disabled={!isEditing}
              placeholder="请输入用户名"
              className={!isEditing ? "bg-gray-50" : ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">邮箱地址</Label>
            <Input
              id="email"
              value={profile?.email || ""}
              disabled={true}
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500">邮箱地址不可修改</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="id_number">学号/工号</Label>
            <Input
              id="id_number"
              value={formData.id_number}
              onChange={(e) => handleInputChange('id_number', e.target.value)}
              disabled={!isEditing}
              placeholder="请输入学号或工号"
              className={!isEditing ? "bg-gray-50" : ""}
            />
          </div>
        </div>

        {/* 角色信息 */}
        <div className="space-y-2">
          <Label>账户角色</Label>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {profile?.role?.name}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 