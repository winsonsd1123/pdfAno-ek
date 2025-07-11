"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Icons } from "@/components/ui/icons"
import { ChevronDown } from "lucide-react"

interface UserAvatarMenuProps {
  /** 组件尺寸 */
  size?: "sm" | "md" | "lg"
  /** 是否显示用户名 */
  showUsername?: boolean
  /** 自定义样式类名 */
  className?: string
}

export function UserAvatarMenu({ 
  size = "md", 
  showUsername = false,
  className = ""
}: UserAvatarMenuProps) {
  const { isAuthenticated, profile, signOut, loading, isAdmin } = useAuth()
  const router = useRouter()

  // 获取头像尺寸
  const avatarSize = {
    sm: "h-8 w-8",
    md: "h-9 w-9", 
    lg: "h-10 w-10"
  }[size]

  // 响应式用户名显示 - 在小屏幕上隐藏用户名
  const shouldShowUsername = showUsername

  // 处理登录
  const handleSignIn = () => {
    router.push('/login')
  }

  // 处理注册
  const handleSignUp = () => {
    router.push('/signup')
  }

  // 处理退出登录
  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  // 处理个人设置
  const handleSettings = () => {
    router.push('/settings')
  }

  // 处理后台管理
  const handleAdmin = () => {
    router.push('/admin')
  }

  // 获取用户显示名称
  const getDisplayName = () => {
    if (!profile) return "用户"
    return profile.full_name || profile.username || "用户"
  }

  // 获取用户头像首字母
  const getAvatarFallback = () => {
    const name = getDisplayName()
    return name.charAt(0).toUpperCase()
  }

  // 如果正在加载
  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`${avatarSize} rounded-full bg-gray-200 animate-pulse`} />
        {shouldShowUsername && (
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse hidden sm:block" />
        )}
      </div>
    )
  }

  // 未登录状态
  if (!isAuthenticated()) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className={`flex items-center space-x-2 hover:bg-gray-100 ${className}`}
          >
            <Avatar className={avatarSize}>
              <AvatarFallback className="bg-gray-200 text-gray-600">
                <Icons.user className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            {shouldShowUsername && (
              <span className="text-sm text-gray-600 hidden sm:inline">未登录</span>
            )}
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>账户操作</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignIn}>
            <Icons.login className="mr-2 h-4 w-4" />
            登录
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignUp}>
            <Icons.user className="mr-2 h-4 w-4" />
            注册
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // 已登录状态
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={`flex items-center space-x-2 hover:bg-gray-100 ${className}`}
        >
          <Avatar className={avatarSize}>
            <AvatarImage 
              src={profile?.avatar_url || undefined} 
              alt={getDisplayName()}
            />
            <AvatarFallback className="bg-gray-700 text-white text-sm font-medium">
              {getAvatarFallback()}
            </AvatarFallback>
          </Avatar>
          {shouldShowUsername && (
            <span className="text-sm text-gray-900 font-medium hidden sm:inline">
              {getDisplayName()}
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {getDisplayName()}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {profile?.username && `@${profile.username}`}
            </p>
            {profile?.role && (
              <p className="text-xs leading-none text-muted-foreground">
                {profile.role.name === 'admin' ? '系统管理员' : '普通用户'}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleSettings}>
          <Icons.settings className="mr-2 h-4 w-4" />
          个人设置
        </DropdownMenuItem>
        
        {/* 仅管理员可见 */}
        {isAdmin() && (
          <DropdownMenuItem onClick={handleAdmin}>
            <Icons.shield className="mr-2 h-4 w-4" />
            后台管理
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <Icons.logout className="mr-2 h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 