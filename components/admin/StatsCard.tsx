"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * 趋势类型
 */
export type TrendType = 'up' | 'down' | 'neutral'

/**
 * StatsCard 组件属性
 */
export interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: {
    type: TrendType
    value: string | number
    label?: string
  }
  className?: string
  loading?: boolean
  onClick?: () => void
}

/**
 * 统计卡片组件
 * 
 * 特性：
 * - 数值展示
 * - 趋势指示
 * - 加载状态
 * - 可点击交互
 */
export function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  className,
  loading = false,
  onClick,
}: StatsCardProps) {
  const getTrendIcon = (type: TrendType) => {
    switch (type) {
      case 'up':
        return <TrendingUp className="h-4 w-4" />
      case 'down':
        return <TrendingDown className="h-4 w-4" />
      case 'neutral':
        return <Minus className="h-4 w-4" />
      default:
        return null
    }
  }

  const getTrendColor = (type: TrendType) => {
    switch (type) {
      case 'up':
        return 'text-green-600 bg-green-50'
      case 'down':
        return 'text-red-600 bg-red-50'
      case 'neutral':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <Card className={cn("hover:shadow-md transition-shadow", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {icon && (
            <div className="text-muted-foreground opacity-50">
              {icon}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card 
      className={cn(
        "hover:shadow-md transition-shadow",
        onClick && "cursor-pointer hover:bg-accent/50",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="text-2xl font-bold">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          
          {(description || trend) && (
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {trend && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "flex items-center space-x-1 px-2 py-1",
                    getTrendColor(trend.type)
                  )}
                >
                  {getTrendIcon(trend.type)}
                  <span>{trend.value}</span>
                  {trend.label && <span>{trend.label}</span>}
                </Badge>
              )}
              {description && <span>{description}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 