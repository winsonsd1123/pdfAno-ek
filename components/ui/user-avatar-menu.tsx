"use client"

import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
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
import { Skeleton } from "./skeleton"

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
  const { data: session, status } = useSession()
  const router = useRouter()

  const user = session?.user

  // 获取头像尺寸
  const avatarSize = {
    sm: "h-8 w-8",
    md: "h-9 w-9", 
    lg: "h-10 w-10"
  }[size]

  const handleSignIn = () => router.push('/login')
  const handleSignUp = () => router.push('/signup')
  const handleSignOut = () => signOut({ callbackUrl: '/' })
  const handleSettings = () => router.push('/settings')
  const handleAdmin = () => router.push('/admin')

  const getDisplayName = () => {
    if (!user) return "用户"
    return user.fullName || user.username || "用户"
  }

  const getAvatarFallback = () => {
    const name = getDisplayName()
    return name ? name.charAt(0).toUpperCase() : <Icons.user className="h-4 w-4" />
  }

  // 加载状态
  if (status === "loading") {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Skeleton className={`${avatarSize} rounded-full`} />
        {showUsername && (
          <Skeleton className="h-4 w-16 hidden sm:block" />
        )}
      </div>
    )
  }

  // 未登录状态
  if (status === "unauthenticated") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className={`flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-slate-800 ${className}`}
          >
            <Avatar className={avatarSize}>
              <AvatarFallback className="bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                <Icons.user className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            {showUsername && (
              <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline">未登录</span>
            )}
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>账户操作</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignIn}>
            <Icons.login className="mr-2 h-4 w-4" />
            <span>登录</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignUp}>
            <Icons.user className="mr-2 h-4 w-4" />
            <span>注册</span>
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
          className={`flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-slate-800 ${className}`}
        >
          <Avatar className={avatarSize}>
            <AvatarImage 
              src={user?.avatarUrl || undefined} 
              alt={getDisplayName()}
            />
            <AvatarFallback className="bg-primary text-primary-foreground font-medium">
              {getAvatarFallback()}
            </AvatarFallback>
          </Avatar>
          {showUsername && (
            <span className="text-sm font-medium hidden sm:inline">
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
              {user?.email}
            </p>
            {user?.role && (
              <p className="text-xs leading-none text-muted-foreground pt-1">
                {user.role === 'admin' ? '系统管理员' : '普通用户'}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleSettings}>
          <Icons.settings className="mr-2 h-4 w-4" />
          <span>个人设置</span>
        </DropdownMenuItem>
        
        {user?.role === 'admin' && (
          <DropdownMenuItem onClick={handleAdmin}>
            <Icons.shield className="mr-2 h-4 w-4" />
            <span>后台管理</span>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <Icons.logout className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 