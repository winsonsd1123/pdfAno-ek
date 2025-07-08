import React, { MouseEvent } from "react"
import { cn } from "@/lib/utils"

interface AnnotationBubbleProps {
  children: React.ReactNode
  isExpanded?: boolean
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  className?: string
}

export function AnnotationBubble({ 
  children, 
  isExpanded = false, 
  onClick,
  className 
}: AnnotationBubbleProps) {
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target && 
        ((e.target as HTMLElement).closest('.annotation-replies-area') || 
         (e.target as HTMLElement).closest('form') ||
         (e.target as HTMLElement).tagName === 'INPUT' ||
         (e.target as HTMLElement).tagName === 'BUTTON')) {
      return;
    }
    
    onClick?.(e);
  };

  return (
    <div
      className={cn(
        "annotation-item flex gap-2 p-3 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors",
        "flex-wrap",
        className
      )}
      onClick={handleClick}
    >
      {children}
    </div>
  )
}

export function AnnotationContent({ 
  children, 
  className 
}: { 
  children: React.ReactNode
  className?: string 
}) {
  return (
    <div className={cn("flex-1 min-w-0 overflow-hidden", className)}>
      {children}
    </div>
  )
}

export function AnnotationHeader({ 
  children, 
  className 
}: { 
  children: React.ReactNode
  className?: string 
}) {
  return (
    <div className={cn("flex items-center gap-2 mb-1 text-xs text-gray-500 flex-wrap", className)}>
      {children}
    </div>
  )
}

export function AnnotationBody({ 
  children, 
  isExpanded = false,
  maxLines = 2,
  className,
  onClick
}: { 
  children: React.ReactNode
  isExpanded?: boolean
  maxLines?: number
  className?: string
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div 
      className={cn(
        "text-sm text-gray-700 leading-relaxed",
        !isExpanded && `line-clamp-${maxLines}`,
        className
      )}
      style={{
        display: !isExpanded ? '-webkit-box' : 'block',
        WebkitLineClamp: !isExpanded ? maxLines : 'none',
        WebkitBoxOrient: 'vertical' as const,
        overflow: !isExpanded ? 'hidden' : 'visible',
        wordBreak: 'break-word'
      }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
