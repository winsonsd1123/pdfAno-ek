import React from "react"
import { cn } from "@/lib/client/utils"

type AnnotationType = "highlight" | "note"

interface AuthorInfo {
  name: string
  role: string
  avatar?: string
  color: string
}

interface AnnotationIconProps {
  author: AuthorInfo
  type: AnnotationType
  className?: string
}

// 根据角色获取配置
function getRoleConfig(author: AuthorInfo) {
  // AI助手的特殊处理
  if (author.role === "AI助手") {
    return {
      icon: author.avatar || "🤖",
      bgColor: "bg-blue-100",
      textColor: "text-blue-700",
      borderColor: "border-blue-200"
    }
  }
  
  // 用户角色的处理
  if (author.color === "green") {
    return {
      icon: author.avatar || "👤",
      bgColor: "bg-green-100",
      textColor: "text-green-700",
      borderColor: "border-green-200"
    }
  }
  
  // 默认配置
  return {
    icon: author.avatar || "👤",
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
    borderColor: "border-gray-200"
  }
}

export function AnnotationIcon({ author, type, className }: AnnotationIconProps) {
  const config = getRoleConfig(author)
  
  return (
    <div
      className={cn(
        "w-6 h-6 rounded-full border flex items-center justify-center text-xs flex-shrink-0",
        config.bgColor,
        config.textColor,
        config.borderColor,
        className
      )}
      title={`${author.name} (${author.role}) - ${type}`}
    >
      {/* 如果是图片URL，显示图片；否则显示emoji或首字母 */}
      {config.icon.startsWith('http') ? (
        <img 
          src={config.icon} 
          alt={author.name} 
          className="w-4 h-4 rounded-full object-cover"
        />
      ) : (
        config.icon
      )}
    </div>
  )
}

export function AnnotationAuthorName({ 
  author, 
  className 
}: { 
  author: AuthorInfo
  className?: string 
}) {
  return (
    <span className={cn("font-medium text-xs", className)}>
      {author.name}
    </span>
  )
}
