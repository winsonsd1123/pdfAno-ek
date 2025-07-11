"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StatsCard } from "@/components/admin"
import { 
  Users, 
  Shield, 
  FileText, 
  Activity,
  Plus,
  TrendingUp,
  Clock,
  UserPlus,
  Settings
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { UserWithRole } from "@/types/supabase"

/**
 * 系统统计接口
 */
interface SystemStats {
  totalUsers: number
  totalRoles: number
  totalDocuments: number
  todayNewUsers: number
  activeUsers: number
  userGrowth: number
}

/**
 * 最近活动接口
 */
interface RecentActivity {
  id: string
  type: 'user_created' | 'role_assigned' | 'document_uploaded' | 'login'
  description: string
  user: string
  timestamp: string
}

/**
 * 管理后台首页组件
 */
export default function AdminDashboard() {
  const { toast } = useToast()

  // 状态管理
  const [stats, setStats] = React.useState<SystemStats>({
    totalUsers: 0,
    totalRoles: 0,
    totalDocuments: 0,
    todayNewUsers: 0,
    activeUsers: 0,
    userGrowth: 0
  })
  const [recentUsers, setRecentUsers] = React.useState<UserWithRole[]>([])
  const [recentActivities, setRecentActivities] = React.useState<RecentActivity[]>([])
  const [loading, setLoading] = React.useState(true)

  // 加载统计数据
  const fetchStats = React.useCallback(async () => {
    try {
      setLoading(true)
      
      const [statsResponse, usersResponse, activitiesResponse] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users?limit=5&sort=created_at&order=desc'),
        fetch('/api/admin/activities?limit=10')
      ])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.data || stats)
      }

      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setRecentUsers(usersData.data || [])
      }

      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json()
        setRecentActivities(activitiesData.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      toast({
        title: "加载失败",
        description: "无法加载仪表板数据，请刷新页面重试",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast, stats])

  // 初始化加载
  React.useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // 快捷操作
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'create_user':
        window.location.href = '/admin/users'
        break
      case 'manage_roles':
        window.location.href = '/admin/roles'
        break
      case 'system_settings':
        window.location.href = '/admin/settings'
        break
      default:
        toast({
          title: "功能开发中",
          description: "该功能正在开发中，敬请期待",
        })
    }
  }

  // 获取活动类型图标和描述
  const getActivityInfo = (activity: RecentActivity) => {
    switch (activity.type) {
      case 'user_created':
        return { icon: <UserPlus className="h-4 w-4" />, color: 'text-green-600' }
      case 'role_assigned':
        return { icon: <Shield className="h-4 w-4" />, color: 'text-blue-600' }
      case 'document_uploaded':
        return { icon: <FileText className="h-4 w-4" />, color: 'text-purple-600' }
      case 'login':
        return { icon: <Activity className="h-4 w-4" />, color: 'text-gray-600' }
      default:
        return { icon: <Activity className="h-4 w-4" />, color: 'text-gray-600' }
    }
  }

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">仪表板</h1>
        <p className="text-muted-foreground">
          欢迎回来！这里是您的系统概览和快捷操作中心
        </p>
      </div>

      {/* 核心统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="总用户数"
          value={stats.totalUsers}
          description="系统注册用户"
          icon={<Users className="h-4 w-4" />}
          trend={{
            type: stats.userGrowth > 0 ? 'up' : stats.userGrowth < 0 ? 'down' : 'neutral',
            value: `${Math.abs(stats.userGrowth)}%`,
            label: '较上月'
          }}
          loading={loading}
          onClick={() => handleQuickAction('manage_users')}
        />
        
        <StatsCard
          title="今日新增"
          value={stats.todayNewUsers}
          description="今天注册的用户"
          icon={<UserPlus className="h-4 w-4" />}
          loading={loading}
        />
        
        <StatsCard
          title="系统角色"
          value={stats.totalRoles}
          description="配置的角色数量"
          icon={<Shield className="h-4 w-4" />}
          loading={loading}
          onClick={() => handleQuickAction('manage_roles')}
        />
        
        <StatsCard
          title="活跃用户"
          value={stats.activeUsers}
          description="近7天活跃用户"
          icon={<Activity className="h-4 w-4" />}
          trend={{
            type: 'up',
            value: '+12%',
            label: '较上周'
          }}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 快捷操作 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>快捷操作</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => handleQuickAction('create_user')}
            >
              <Plus className="mr-2 h-4 w-4" />
              创建新用户
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => handleQuickAction('manage_roles')}
            >
              <Shield className="mr-2 h-4 w-4" />
              管理角色权限
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => handleQuickAction('system_settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              系统设置
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => handleQuickAction('view_reports')}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              查看报表
            </Button>
          </CardContent>
        </Card>

        {/* 最近注册用户 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>最近注册用户</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                    <div className="space-y-1 flex-1">
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentUsers.length > 0 ? (
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url || ''} />
                      <AvatarFallback>
                        {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.full_name || user.username || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.id}
                      </p>
                    </div>
                    {user.role && (
                      <Badge variant="secondary" className="text-xs">
                        {user.role.name}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                暂无最近注册的用户
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 系统活动时间线 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>最近活动</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                  <div className="space-y-1 flex-1">
                    <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const { icon, color } = getActivityInfo(activity)
                return (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className={`mt-1 ${color}`}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{activity.description}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {activity.user}
                        </p>
                        <span className="text-xs text-muted-foreground">•</span>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              暂无系统活动记录
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 