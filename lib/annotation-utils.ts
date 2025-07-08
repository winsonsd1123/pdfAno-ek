export type AnnotationRole = "AI助手" | "手动批注者" | "导师" | "同学"

export interface AuthorInfo {
  name: string
  role: AnnotationRole
  avatar?: string
  color: string
}

export interface OriginalAIAnnotation {
  selectedText: string
  title: string
  description: string
  suggestion: string
  annotationType: string
  severity: string
}

// 角色配置
export const ANNOTATION_ROLES: Record<AnnotationRole, AuthorInfo> = {
  "AI助手": {
    name: "AI教授",
    role: "AI助手",
    avatar: "🤖",
    color: "blue"
  },
  "手动批注者": {
    name: "我",
    role: "手动批注者", 
    avatar: "👤",
    color: "green"
  },
  "导师": {
    name: "导师",
    role: "导师",
    avatar: "👨‍🏫",
    color: "yellow"
  },
  "同学": {
    name: "同学", 
    role: "同学",
    avatar: "👥",
    color: "purple"
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

// 为现有批注添加默认author信息
export function addDefaultAuthorInfo(role: AnnotationRole = "手动批注者"): AuthorInfo {
  return ANNOTATION_ROLES[role]
}

// 截断文本用于预览
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength) + "..."
}
