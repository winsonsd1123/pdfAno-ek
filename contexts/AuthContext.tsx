// ======================================================================
// 认证上下文 - 全局用户状态管理
// ======================================================================
// 
// 这个组件提供全局的用户认证状态管理，包括：
// 1. 用户登录状态
// 2. 用户资料信息（包含角色）
// 3. 认证相关的操作（登录、登出、注册）
// 4. 权限检查工具函数
// 
// 重构后：所有数据操作通过API调用，不直接使用Supabase
// 
// ======================================================================

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { UserWithRole } from '@/types/supabase';

interface AuthContextType {
  // 状态
  user: User | null;
  profile: UserWithRole | null;
  loading: boolean;
  
  // 操作
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, userData?: Partial<UserWithRole>) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  
  // 权限检查
  hasPermission: (action: string, subject: string) => boolean;
  isAdmin: () => boolean;
  isAuthenticated: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 认证提供者组件
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * 获取当前用户信息
   */
  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setProfile(data.profile);
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      setUser(null);
      setProfile(null);
    }
  };

  /**
   * 刷新用户资料
   */
  const refreshProfile = async () => {
    await fetchCurrentUser();
  };

  /**
   * 登录
   */
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setProfile(data.profile);
        return {};
      } else {
        return { error: data.error };
      }
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: 'An unexpected error occurred' };
    } finally {
      setLoading(false);
    }
  };

  /**
   * 注册
   */
  const signUp = async (
    email: string, 
    password: string, 
    userData?: Partial<UserWithRole>
  ) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, userData }),
      });

      const data = await response.json();

      if (data.success) {
        // 注册成功，但可能需要邮箱验证
        return {};
      } else {
        return { error: data.error };
      }
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: 'An unexpected error occurred' };
    } finally {
      setLoading(false);
    }
  };

  /**
   * 登出
   */
  const signOut = async () => {
    try {
      setLoading(true);
      
      await fetch('/api/auth/logout', {
        method: 'POST',
      });

      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 权限检查
   */
  const hasPermission = (action: string, subject: string): boolean => {
    if (!profile?.role) return false;

    // 管理员拥有所有权限
    if (profile.role.name === 'admin') return true;

    // 检查具体权限
    const permissions = (profile.role as any).permissions || [];
    return permissions.some((permission: any) => 
      (permission.action === action || permission.action === 'manage') &&
      (permission.subject === subject || permission.subject === 'all')
    );
  };

  /**
   * 检查是否为管理员
   */
  const isAdmin = (): boolean => {
    return profile?.role?.name === 'admin';
  };

  /**
   * 检查是否已认证
   */
  const isAuthenticated = (): boolean => {
    return !!user;
  };

  /**
   * 初始化认证状态
   */
  useEffect(() => {
    const initializeAuth = async () => {
      await fetchCurrentUser();
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    hasPermission,
    isAdmin,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 使用认证上下文的 Hook
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * 权限保护组件
 */
export function ProtectedComponent({ 
  action, 
  subject, 
  children,
  fallback = null 
}: {
  action: string;
  subject: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasPermission } = useAuth();
  
  if (!hasPermission(action, subject)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * 认证保护组件
 */
export function RequireAuth({ 
  children,
  fallback = <div>Please sign in to access this content.</div>
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated()) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
} 