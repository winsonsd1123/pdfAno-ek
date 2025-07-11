-- ======================================================================
-- 行级安全策略 (Row Level Security Policies) 设置脚本
-- ======================================================================
-- 
-- 用途: 为用户认证系统的数据表设置基础的行级安全策略
-- 执行环境: Supabase PostgreSQL
-- 前置条件: 必须先执行 init-auth-system.sql 脚本
-- 
-- 说明: 
-- 虽然我们采用混合 API 模式，在应用层做主要的权限控制，
-- 但 RLS 作为数据库层的最后一道防线，仍然很有价值。
-- 
-- ======================================================================

-- ======================================================================
-- 安全辅助函数：检查管理员权限
-- ======================================================================
-- 这个函数是解决 RLS 策略递归问题的关键。
-- 它通过 SECURITY DEFINER 以函数创建者（通常是超级用户）的权限运行，
-- 从而绕过调用者自身的 RLS 策略，安全地检查用户是否有关联的 'admin' 角色。
-- 这样可以避免在 'roles' 表的策略中再次查询 'roles' 表导致的无限循环。

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = user_id AND r.name = 'admin'
  ) INTO is_admin_user;
  RETURN is_admin_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1. 为 profiles 表启用 RLS 并设置策略
-- 这确保用户只能访问自己的个人资料
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 先删除旧策略，保证脚本可重复执行
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 策略：用户可以查看自己的个人资料
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- 策略：用户可以更新自己的个人资料
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 策略：用户可以插入自己的个人资料（主要用于注册时的触发器）
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. 为 roles 表启用 RLS
-- 角色表只有管理员能修改，但所有认证用户都能读取
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- 先删除旧策略
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.roles;

-- 策略：所有认证用户都能读取角色信息
CREATE POLICY "Authenticated users can view roles" ON public.roles
    FOR SELECT USING (auth.role() = 'authenticated');

-- 策略：只有管理员能修改角色 (使用 is_admin 函数避免递归)
CREATE POLICY "Only admins can manage roles" ON public.roles
    FOR ALL USING (public.is_admin(auth.uid()));

-- 3. 为 permissions 表启用 RLS
-- 权限表所有认证用户都能读，只有管理员能改
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- 先删除旧策略
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.permissions;
DROP POLICY IF EXISTS "Only admins can manage permissions" ON public.permissions;

-- 策略：所有认证用户都能读取权限信息
CREATE POLICY "Authenticated users can view permissions" ON public.permissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- 策略：只有管理员能修改权限 (使用 is_admin 函数避免递归)
CREATE POLICY "Only admins can manage permissions" ON public.permissions
    FOR ALL USING (public.is_admin(auth.uid()));

-- 4. 为 role_permissions 表启用 RLS
-- 角色权限关联表，同样只有管理员能操作
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 先删除旧策略
DROP POLICY IF EXISTS "Authenticated users can view role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Only admins can manage role permissions" ON public.role_permissions;

-- 策略：所有认证用户都能读取角色权限关系
CREATE POLICY "Authenticated users can view role permissions" ON public.role_permissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- 策略：只有管理员能修改角色权限关系 (使用 is_admin 函数避免递归)
CREATE POLICY "Only admins can manage role permissions" ON public.role_permissions
    FOR ALL USING (public.is_admin(auth.uid()));

-- ======================================================================
-- 脚本执行完毕
-- ======================================================================
-- 
-- 验证方法:
-- 1. 尝试以普通用户身份查询 profiles 表，应该只能看到自己的记录
-- 2. 尝试以普通用户身份修改 roles 表，应该被拒绝
-- 3. 以管理员身份应该能正常操作所有表
-- 
-- 注意：这些 RLS 策略作为最后一道防线。主要的权限控制
-- 应该在 Next.js API 路由层面进行，这样更灵活、更好维护。
-- 
-- ====================================================================== 