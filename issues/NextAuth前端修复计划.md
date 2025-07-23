# NextAuth.js前端修复计划

## 问题背景

### 🚨 严重问题发现
在NextAuth.js迁移过程中，`contexts/AuthContext.tsx`文件被删除，但仍有**7个重要文件**在引用它，导致整个应用无法启动。

### 受影响文件清单
1. `app/page.tsx` - 使用 `isAdmin`, `isAuthenticated`, `loading`
2. `app/settings/page.tsx` - 使用 `isAuthenticated`, `loading`  
3. `app/admin/layout.tsx` - 使用 `useAuth`
4. `components/settings/PersonalInfoCard.tsx` - 使用 `profile`, `refreshProfile`
5. `components/settings/AccountSecurityCard.tsx` - 使用 `profile`
6. `components/pdf-ano/SidePanel.tsx` - 使用 `useAuth`
7. `contexts/PdfAnoContext.tsx` - 使用 `profile`

### 当前状态
- ✅ 后端API重构完成 (18/18个端点)
- ❌ 前端组件迁移不完整 (~3/10)
- ❌ 应用无法启动 (导入错误)
- ❌ 缺少环境变量配置

## 修复方案

选择**方案1：刮骨疗毒，彻底迁移**
- 将所有组件从 `useAuth` 迁移到 NextAuth.js 的 `useSession`
- 消除技术债务，实现代码统一

## 详细执行计划

### 阶段1：环境配置和基础设施
**任务1**: 添加环境变量配置文件
- 创建 `.env.local.example` 
- 添加 `NEXTAUTH_SECRET` 和 `NEXTAUTH_URL` 配置说明
- 更新README.md环境配置部分

**任务2**: 验证NextAuth配置完整性
- 检查 `app/api/auth/[...nextauth]/route.ts` 
- 确保类型定义 `types/next-auth.d.ts` 正确
- 验证 `app/providers.tsx` 和 `app/layout.tsx` 配置

### 阶段2：核心组件迁移 (P0 - 关键路径)
**任务3**: 迁移主页面 - `app/page.tsx`
- 替换 `const { isAdmin, isAuthenticated, loading } = useAuth()`
- 改为 `const { data: session, status } = useSession()`
- 更新条件判断逻辑：
  - `isAuthenticated()` → `status === 'authenticated'`
  - `loading` → `status === 'loading'`
  - `isAdmin` → `session?.user?.role === 'admin'`

**任务4**: 迁移设置页面 - `app/settings/page.tsx`
- 替换认证检查逻辑
- 更新重定向处理
- 修改Loading状态显示

**任务5**: 迁移管理后台布局 - `app/admin/layout.tsx`
- 更新管理员权限检查
- 修改导航组件和用户状态显示

### 阶段3：用户功能组件迁移
**任务6**: 迁移个人信息卡片 - `components/settings/PersonalInfoCard.tsx`
- 替换 `const { profile, refreshProfile } = useAuth()`
- 改为从 `session?.user` 获取用户信息
- 实现profile刷新机制（调用 `update()` 或重新获取session）

**任务7**: 迁移账户安全卡片 - `components/settings/AccountSecurityCard.tsx`
- 更新用户配置获取方式
- 修改profile相关逻辑

**任务8**: 迁移PDF标注侧边栏 - `components/pdf-ano/SidePanel.tsx`
- 更新用户信息显示
- 修改认证状态检查

### 阶段4：上下文重构
**任务9**: 重构PDF标注上下文 - `contexts/PdfAnoContext.tsx`
- 替换 `const { profile } = useAuth()` 依赖
- 改为 `const { data: session } = useSession()`
- 使用 `session?.user` 获取用户信息

### 阶段5：验证和清理
**任务10**: 全局搜索和清理
- 搜索所有 `useAuth` 引用确保无遗漏
- 搜索所有 `@/contexts/AuthContext` 导入
- 删除无用的导入语句

**任务11**: 功能验证测试
- [ ] 应用正常启动
- [ ] 登录/注册流程
- [ ] 受保护路由访问(/pdfano, /settings, /admin)
- [ ] 用户设置功能(个人信息、密码修改)
- [ ] 管理后台访问和权限控制
- [ ] PDF标注功能和用户状态

**任务12**: 性能和用户体验优化
- 添加统一的Loading状态处理
- 优化认证状态切换体验
- 添加错误边界处理

## 技术要点

### useAuth → useSession 迁移映射
\`\`\`typescript
// 旧方式
const { profile, isAuthenticated, isAdmin, loading } = useAuth()

// 新方式  
const { data: session, status, update } = useSession()
const profile = session?.user
const isAuthenticated = status === 'authenticated'
const isAdmin = session?.user?.role === 'admin'
const loading = status === 'loading'
\`\`\`

### 用户信息获取
\`\`\`typescript
// 旧方式
profile?.full_name
profile?.email
profile?.avatar_url

// 新方式
session?.user?.fullName
session?.user?.email  
session?.user?.avatarUrl
\`\`\`

### 刷新用户信息
\`\`\`typescript
// 旧方式
await refreshProfile()

// 新方式
await update() // 或重新获取session
\`\`\`

## 风险控制

1. **分步测试**: 每完成一个组件立即测试功能
2. **Git管理**: 保持提交粒度细化，便于回滚
3. **功能验证**: 重要节点进行完整功能测试
4. **备用方案**: 如遇到复杂问题，可临时创建AuthContext兼容层

## 预期结果

- ✅ 应用可以正常启动和运行
- ✅ 所有认证功能正常工作  
- ✅ 用户状态管理统一使用NextAuth
- ✅ 类型安全和代码一致性
- ✅ 消除所有认证相关技术债务

## 时间估算

- 预计总时间：2-3小时
- 关键路径(阶段2)：1小时
- 组件迁移(阶段3)：1小时
- 验证测试：30-60分钟

---

**优先级**: P0 (应用无法启动)
**负责人**: 待分配
**创建时间**: 2024年当前日期
**状态**: 待开始
