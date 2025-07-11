"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { UserAvatarMenu } from "@/components/ui/user-avatar-menu"
import { PersonalInfoCard } from "@/components/settings/PersonalInfoCard"
import { AccountSecurityCard } from "@/components/settings/AccountSecurityCard"
import { FileText, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"

export default function SettingsPage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  // 如果未登录，重定向到登录页
  useEffect(() => {
    if (!loading && !isAuthenticated()) {
      router.push('/login?redirect=/settings')
    }
  }, [isAuthenticated, loading, router])

  // 如果正在加载认证状态
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">加载中...</div>
      </div>
    )
  }

  // 如果未登录
  if (!isAuthenticated()) {
    return null // 会被重定向，这里不需要显示内容
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-gray-700" />
              <h1 className="text-xl font-semibold text-gray-900">PDF Analyzer</h1>
            </div>
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                首页
              </Link>
              <Link href="/works" className="text-gray-600 hover:text-gray-900 transition-colors">
                工作台
              </Link>
              <Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
                功能
              </Link>
              <Link href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
                定价
              </Link>
              <Link href="#help" className="text-gray-600 hover:text-gray-900 transition-colors">
                帮助
              </Link>
              <UserAvatarMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">个人设置</h2>
          <p className="text-lg text-gray-600">
            管理您的账户信息和安全设置
          </p>
        </div>

        {/* Settings Content */}
        <div className="space-y-8">
          {/* 个人信息卡片 */}
          <PersonalInfoCard />
          
          {/* 账户安全卡片 */}
          <AccountSecurityCard />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-400">© 2024 PDF Analyzer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
} 