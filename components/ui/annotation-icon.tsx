import React from "react"
import { cn } from "@/lib/utils"

type AnnotationRole = "AI助手" | "手动批注者" | "导师" | "同学"
type AnnotationType = "highlight" | "note"

interface AnnotationIconProps {
  role: AnnotationRole
  type: AnnotationType
  className?: string
}

const ROLE_CONFIG = {
  "AI助手": {
    icon: "🤖",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
    borderColor: "border-blue-200"
  },
  "手动批注者": {
    icon: "👤",
    bgColor: "bg-green-100", 
    textColor: "text-green-700",
    borderColor: "border-green-200"
  },
  "导师": {
    icon: "👨‍🏫",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-700", 
    borderColor: "border-yellow-200"
  },
  "同学": {
    icon: "👥",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
    borderColor: "border-purple-200"
  }
}

export function AnnotationIcon({ role, type, className }: AnnotationIconProps) {
  const config = ROLE_CONFIG[role]
  
  return (
    <div
      className={cn(
        "w-6 h-6 rounded-full border flex items-center justify-center text-xs flex-shrink-0",
        config.bgColor,
        config.textColor,
        config.borderColor,
        className
      )}
      title={`${role} - ${type}`}
    >
      {config.icon}
    </div>
  )
}

export function AnnotationAuthorName({ 
  role, 
  className 
}: { 
  role: AnnotationRole
  className?: string 
}) {
  const displayNames = {
    "AI助手": "AI教授",
    "手动批注者": "我",
    "导师": "导师",
    "同学": "同学"
  }
  
  return (
    <span className={cn("font-medium text-xs", className)}>
      {displayNames[role]}
    </span>
  )
} 