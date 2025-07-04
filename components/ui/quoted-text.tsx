import React from "react"
import { cn } from "@/lib/utils"

interface QuotedTextProps {
  text: string
  className?: string
}

export function QuotedText({ text, className }: QuotedTextProps) {
  if (!text || text === "无特定位置") {
    return null
  }
  
  return (
    <div className={cn("mb-2", className)}>
      <div className="bg-gray-50 border-l-3 border-l-gray-300 pl-3 py-2 rounded-r text-sm italic text-gray-600 break-words whitespace-pre-line max-w-full overflow-auto">
        <span className="text-xs text-gray-400 block mb-1">引用文字:</span>
        {`"${text}"`}
      </div>
    </div>
  )
} 