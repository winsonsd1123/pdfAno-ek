"use client"

import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * 确认类型
 */
export type ConfirmType = 'danger' | 'warning' | 'info'

/**
 * ConfirmDialog 组件属性
 */
export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  type?: ConfirmType
  loading?: boolean
  onConfirm: () => void | Promise<void>
  className?: string
}

/**
 * 操作确认对话框组件
 * 
 * 特性：
 * - 支持多种确认类型
 * - 异步操作支持
 * - 加载状态展示
 * - 可自定义按钮文本
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  type = 'warning',
  loading = false,
  onConfirm,
  className,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      // 错误处理由父组件负责
      console.error('Confirm action failed:', error)
    }
  }

  const getConfirmButtonVariant = () => {
    switch (type) {
      case 'danger':
        return 'destructive' as const
      case 'warning':
        return 'default' as const
      case 'info':
        return 'default' as const
      default:
        return 'default' as const
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return '⚠️'
      case 'warning':
        return '❓'
      case 'info':
        return 'ℹ️'
      default:
        return '❓'
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={cn("sm:max-w-md", className)}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center space-x-2">
            <span className="text-lg">{getIcon()}</span>
            <span>{title}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            disabled={loading}
            className="mr-2"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={getConfirmButtonVariant()}
            onClick={handleConfirm}
            disabled={loading}
            className="min-w-[80px]"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>处理中...</span>
              </div>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Hook：便捷的确认对话框状态管理
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [config, setConfig] = React.useState<Partial<ConfirmDialogProps>>({})

  const showConfirm = (props: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>) => {
    setConfig(props)
    setIsOpen(true)
  }

  const hideConfirm = () => {
    setIsOpen(false)
    // 延迟清理配置，避免关闭动画时显示空内容
    setTimeout(() => setConfig({}), 200)
  }

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={hideConfirm}
      title=""
      description=""
      {...config}
    />
  )

  return {
    showConfirm,
    hideConfirm,
    ConfirmDialog: ConfirmDialogComponent,
  }
} 