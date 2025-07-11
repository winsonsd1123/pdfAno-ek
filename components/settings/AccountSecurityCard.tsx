"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icons } from "@/components/ui/icons"
import { useToast } from "@/hooks/use-toast"
import { Shield, Lock, Save, Edit, Eye, EyeOff } from "lucide-react"

export function AccountSecurityCard() {
  const { profile } = useAuth()
  const { toast } = useToast()
  
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })

  // 处理密码输入变化
  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 切换密码可见性
  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  // 验证密码表单
  const validatePasswordForm = () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData

    if (!currentPassword) {
      toast({
        variant: "destructive",
        title: "请输入当前密码",
      })
      return false
    }

    if (!newPassword) {
      toast({
        variant: "destructive",
        title: "请输入新密码",
      })
      return false
    }

    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "新密码长度至少需要6位",
      })
      return false
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "两次输入的新密码不一致",
      })
      return false
    }

    if (currentPassword === newPassword) {
      toast({
        variant: "destructive",
        title: "新密码不能与当前密码相同",
      })
      return false
    }

    return true
  }

  // 修改密码
  const handleChangePassword = async () => {
    if (!validatePasswordForm()) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      })

      if (response.ok) {
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        })
        setIsChangingPassword(false)
        toast({
          title: "密码修改成功",
          description: "请使用新密码重新登录",
        })
      } else {
        const result = await response.json()
        toast({
          variant: "destructive",
          title: "密码修改失败",
          description: result.error || "未知错误",
        })
      }
    } catch (error) {
      console.error('Change password error:', error)
      toast({
        variant: "destructive",
        title: "密码修改失败",
        description: "网络错误，请重试",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 取消修改密码
  const handleCancelPasswordChange = () => {
    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    })
    setIsChangingPassword(false)
  }

  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-gray-700" />
            <span>账户安全</span>
          </CardTitle>
          {!isChangingPassword && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChangingPassword(true)}
            >
              <Lock className="h-4 w-4 mr-2" />
              修改密码
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 账户信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>账户状态</Label>
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-700">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  正常
                </span>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>最后更新</Label>
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-700">
                {profile?.updated_at 
                  ? new Date(profile.updated_at).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '未知'
                }
              </p>
            </div>
          </div>
        </div>

        {/* 密码修改表单 */}
        {isChangingPassword && (
          <div className="border-t pt-6">
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">修改密码</h4>
              
              <div className="space-y-2">
                <Label htmlFor="currentPassword">当前密码</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPasswords.current ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                    placeholder="请输入当前密码"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => togglePasswordVisibility('current')}
                  >
                    {showPasswords.current ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPasswords.new ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                    placeholder="请输入新密码（至少6位）"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => togglePasswordVisibility('new')}
                  >
                    {showPasswords.new ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认新密码</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPasswords.confirm ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                    placeholder="请再次输入新密码"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => togglePasswordVisibility('confirm')}
                  >
                    {showPasswords.confirm ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleCancelPasswordChange}
                  disabled={isLoading}
                >
                  取消
                </Button>
                <Button
                  onClick={handleChangePassword}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
                      修改中...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      确认修改
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 安全提示 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">安全提示</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 建议定期更换密码以保证账户安全</li>
            <li>• 密码应包含字母、数字，长度至少6位</li>
            <li>• 不要在公共场所或他人面前输入密码</li>
            <li>• 如发现账户异常，请及时修改密码并联系管理员</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
} 