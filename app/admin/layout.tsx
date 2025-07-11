// ======================================================================
// 管理后台布局 - 现代化管理界面
// ======================================================================
// 
// 设计风格：
// - OpenAI 风格的现代化布局
// - 侧边栏导航 + 主内容区域
// - 深色主题 + 精致渐变
// - 响应式设计，支持移动端
// 
// ======================================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: keyof typeof Icons;
  description: string;
}

const navItems: NavItem[] = [
  {
    title: '总览',
    href: '/admin',
    icon: 'home',
    description: '系统概览和统计'
  },
  {
    title: '用户管理',
    href: '/admin/users',
    icon: 'users',
    description: '管理系统用户'
  },
  {
    title: '角色管理',
    href: '/admin/roles',
    icon: 'shield',
    description: '配置用户角色'
  },
  {
    title: '系统设置',
    href: '/admin/settings',
    icon: 'settings',
    description: '系统配置选项'
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut, isAdmin } = useAuth();

  // 如果不是管理员，显示无权限页面
  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Icons.shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">访问被拒绝</h1>
          <p className="text-muted-foreground mb-6">您没有访问管理后台的权限</p>
          <Link href="/pdfano">
            <Button variant="outline">
              返回主页
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card text-card-foreground border-r border-border transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo 区域 */}
        <div className="flex items-center gap-2 h-16 px-6 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Icons.shield className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              PDF Analyzer
            </h1>
            <p className="text-xs text-muted-foreground">Management Console</p>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = Icons[item.icon];
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <div className="flex-1">
                  <div>{item.title}</div>
                  <div className="text-xs text-muted-foreground group-hover:text-muted-foreground/80">
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* 用户信息区域 */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Icons.user className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.full_name || profile?.username || '管理员'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.role?.name === 'admin' ? '系统管理员' : '用户'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Icons.logout className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="lg:pl-64">
        {/* 顶部栏 */}
        <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between h-full px-6">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <Icons.menu className="w-5 h-5" />
            </Button>

            <div className="hidden sm:block">
              <h2 className="text-lg font-semibold text-foreground">
                {navItems.find(item => item.href === pathname)?.title || '管理后台'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {navItems.find(item => item.href === pathname)?.description || '系统管理控制台'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Icons.bell className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Icons.help className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
} 