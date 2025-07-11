// ======================================================================
// 登录页面 - 现代化 AI 风格设计
// ======================================================================
// 
// 设计风格：
// - 深色主题 + 渐变背景
// - 现代化卡片式布局
// - 微交互动效
// - OpenAI 风格的精致设计
// 
// ======================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icons } from '@/components/ui/icons';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signIn, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const redirectTo = searchParams.get('redirect') || '/pdfano';

  // 如果已登录，重定向
  useEffect(() => {
    if (isAuthenticated()) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    const result = await signIn(email, password);
    
    if (result.error) {
      setError(result.error);
      toast({
        variant: "destructive",
        title: "登录失败",
        description: result.error,
      });
    } else {
      toast({
        title: "登录成功",
        description: "欢迎回来！",
      });
      router.push(redirectTo);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden">
      {/* 动态渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_70%)]" />
        <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.02] bg-[size:60px_60px]" />
      </div>

      {/* 浮动装饰元素 */}
      <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500/10 rounded-full blur-xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-blue-500/10 rounded-full blur-xl animate-pulse delay-1000" />

      {/* 主要内容 */}
      <div className="relative z-10 w-full max-w-md px-4">
        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1 pb-8">
                         <div className="flex items-center justify-center mb-4">
               <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                 <Icons.lock className="w-6 h-6 text-white" />
               </div>
             </div>
            <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              欢迎回来
            </CardTitle>
            <CardDescription className="text-center text-slate-400">
              登录您的账户以继续使用智能PDF分析平台
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
                             {error && (
                 <Alert variant="destructive" className="border-red-800 bg-red-900/20">
                   <Icons.alertCircle className="h-4 w-4" />
                   <AlertDescription>{error}</AlertDescription>
                 </Alert>
               )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">邮箱地址</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="输入您的邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-purple-500 transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="输入您的密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-purple-500 transition-colors"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-2.5 transition-all duration-200 shadow-lg hover:shadow-xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    <Icons.login className="mr-2 h-4 w-4" />
                    登录
                  </>
                )}
              </Button>
            </CardContent>
          </form>

          <CardFooter className="flex flex-col space-y-4 pt-6">
            <div className="text-center text-sm text-slate-400">
              还没有账户？{' '}
              <Link 
                href="/signup" 
                className="text-purple-400 hover:text-purple-300 transition-colors font-medium"
              >
                立即注册
              </Link>
            </div>
            
            <div className="text-center">
              <Link 
                href="/" 
                className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
              >
                返回首页
              </Link>
            </div>
          </CardFooter>
        </Card>

        {/* 底部装饰文本 */}
        <div className="text-center mt-8 text-slate-500 text-sm">
          <p>安全登录 • 数据加密 • 隐私保护</p>
        </div>
      </div>
    </div>
  );
} 