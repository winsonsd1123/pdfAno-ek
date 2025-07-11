// ======================================================================
// 注册页面 - 现代化 AI 风格设计
// ======================================================================
// 
// 设计风格：
// - 与登录页面保持一致的现代化设计
// - 增加用户名、真实姓名、学号等字段
// - 流畅的表单验证和用户体验
// 
// ======================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icons } from '@/components/ui/icons';
import { useToast } from '@/hooks/use-toast';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    full_name: '',
    id_number: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signUp, isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // 如果已登录，重定向
  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/pdfano');
    }
  }, [isAuthenticated, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const { email, password, confirmPassword, username, full_name } = formData;
    
    if (!email || !password || !username || !full_name) {
      return '请填写所有必填字段';
    }
    
    if (password.length < 6) {
      return '密码长度至少需要6位';
    }
    
    if (password !== confirmPassword) {
      return '两次输入的密码不一致';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return '请输入有效的邮箱地址';
    }
    
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setIsLoading(false);
      return;
    }

    const result = await signUp(formData.email, formData.password, {
      username: formData.username,
      full_name: formData.full_name,
      id_number: formData.id_number || null,
    });
    
    if (result.error) {
      setError(result.error);
      toast({
        variant: "destructive",
        title: "注册失败",
        description: result.error,
      });
    } else {
      toast({
        title: "注册成功",
        description: "欢迎加入智能PDF分析平台！请查收邮箱确认邮件。",
      });
      router.push('/login');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden py-12">
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
          <CardHeader className="space-y-1 pb-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                <Icons.userCircle className="w-6 h-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              创建账户
            </CardTitle>
            <CardDescription className="text-center text-slate-400">
              注册新账户，开启智能PDF分析之旅
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
                             {error && (
                 <Alert variant="destructive" className="border-red-800 bg-red-900/20">
                   <Icons.alertCircle className="h-4 w-4" />
                   <AlertDescription>{error}</AlertDescription>
                 </Alert>
               )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-300">
                    用户名 <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="设置用户名"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-purple-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-slate-300">
                    真实姓名 <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    type="text"
                    placeholder="输入真实姓名"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-purple-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  邮箱地址 <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="输入邮箱地址"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-purple-500 transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="id_number" className="text-slate-300">
                  学号/工号
                  <span className="text-slate-500 text-sm ml-1">(可选)</span>
                </Label>
                <Input
                  id="id_number"
                  name="id_number"
                  type="text"
                  placeholder="输入学号或工号"
                  value={formData.id_number}
                  onChange={handleInputChange}
                  className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  密码 <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="设置密码 (至少6位)"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-purple-500 transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300">
                  确认密码 <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="再次输入密码"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
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
                     注册中...
                   </>
                 ) : (
                   <>
                     <Icons.userCircle className="mr-2 h-4 w-4" />
                     创建账户
                   </>
                 )}
              </Button>
            </CardContent>
          </form>

          <CardFooter className="flex flex-col space-y-4 pt-6">
            <div className="text-center text-sm text-slate-400">
              已有账户？{' '}
              <Link 
                href="/login" 
                className="text-purple-400 hover:text-purple-300 transition-colors font-medium"
              >
                立即登录
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
          <p>注册即表示您同意我们的服务条款和隐私政策</p>
        </div>
      </div>
    </div>
  );
} 