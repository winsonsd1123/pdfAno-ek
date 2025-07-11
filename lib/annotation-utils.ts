export type AnnotationRole = "AI助手" | "当前用户"

export interface AuthorInfo {
  name: string
  role: string
  avatar?: string
  color: string
}

// 引入用户类型
import type { UserWithRole } from '@/types/supabase'

export interface OriginalAIAnnotation {
  selectedText: string
  title: string
  description: string
  suggestion: string
  annotationType: string
  severity: string
}

// 动态角色配置函数
export function createAnnotationRoles(currentUser: UserWithRole | null): Record<AnnotationRole, AuthorInfo> {
  return {
    "AI助手": {
      name: "AI教授",
      role: "AI助手",
      avatar: "🤖",
      color: "blue"
    },
    "当前用户": {
      name: currentUser?.full_name || currentUser?.username || "匿名用户",
      role: currentUser?.role?.name || "普通用户",
      avatar: currentUser?.avatar_url || "👤",
      color: "green"
    }
  }
}

// 内容合并函数 - 教师点评风格
export function mergeAnnotationContent(aiData: OriginalAIAnnotation): string {
  const { selectedText, title, description, suggestion } = aiData
  
  if (selectedText && selectedText !== "无特定位置") {
    return `关于"${selectedText}"这部分内容：\n\n${description}\n\n${suggestion}`
  } else {
    return `${title}\n\n${description}\n\n${suggestion}`
  }
}

// 时间戳格式化
export function formatTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) {
    return "刚刚"
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}分钟前`
  } else if (diffInMinutes < 24 * 60) {
    const hours = Math.floor(diffInMinutes / 60)
    return `${hours}小时前`
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

// 生成当前时间戳
export function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

// 为现有批注添加默认author信息 - 需要传入用户信息
export function addDefaultAuthorInfo(
  annotationRoles: Record<AnnotationRole, AuthorInfo>, 
  role: AnnotationRole = "当前用户"
): AuthorInfo {
  return annotationRoles[role]
}

// 截断文本用于预览
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength) + "..."
}
