"use client"

import React from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon,
  RotateCcw 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"

/**
 * 筛选字段类型
 */
export type FilterFieldType = 'text' | 'select' | 'date-range' | 'number'

/**
 * 筛选字段定义
 */
export interface FilterField {
  key: string
  label: string
  type: FilterFieldType
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  defaultValue?: any
}

/**
 * 筛选值类型
 */
export interface FilterValue {
  [key: string]: any
}

/**
 * SearchFilter 组件属性
 */
export interface SearchFilterProps {
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  fields?: FilterField[]
  filters?: FilterValue
  onFiltersChange?: (filters: FilterValue) => void
  onReset?: () => void
  className?: string
  showFilterCount?: boolean
}

/**
 * 搜索筛选组件
 * 
 * 特性：
 * - 文本搜索框
 * - 多类型筛选字段
 * - 筛选状态显示
 * - 一键重置功能
 */
export function SearchFilter({
  searchPlaceholder = "搜索...",
  searchValue = "",
  onSearchChange,
  fields = [],
  filters = {},
  onFiltersChange,
  onReset,
  className,
  showFilterCount = true,
}: SearchFilterProps) {
  const [isFilterOpen, setIsFilterOpen] = React.useState(false)
  const [localFilters, setLocalFilters] = React.useState<FilterValue>(filters)

  // 同步外部筛选值
  React.useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  // 计算活动筛选器数量
  const activeFilterCount = React.useMemo(() => {
    return Object.entries(localFilters).filter(([key, value]) => {
      if (value === undefined || value === null || value === '') return false
      if (Array.isArray(value) && value.length === 0) return false
      return true
    }).length
  }, [localFilters])

  // 处理筛选值变化
  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...localFilters, [key]: value }
    setLocalFilters(newFilters)
    onFiltersChange?.(newFilters)
  }

  // 重置所有筛选
  const handleReset = () => {
    const resetFilters: FilterValue = {}
    fields.forEach(field => {
      resetFilters[field.key] = field.defaultValue || ''
    })
    setLocalFilters(resetFilters)
    onFiltersChange?.(resetFilters)
    onReset?.()
  }

  // 渲染筛选字段
  const renderFilterField = (field: FilterField) => {
    const value = localFilters[field.key] || field.defaultValue || ''

    switch (field.type) {
      case 'text':
        return (
          <Input
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleFilterChange(field.key, e.target.value)}
          />
        )

      case 'select':
        return (
          <Select
            value={value}
            onValueChange={(newValue) => handleFilterChange(field.key, newValue)}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || `选择${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'date-range':
        return (
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !value?.start && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value?.start ? format(value.start, "yyyy-MM-dd", { locale: zhCN }) : "开始日期"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={value?.start}
                  onSelect={(date) => handleFilterChange(field.key, { ...value, start: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !value?.end && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value?.end ? format(value.end, "yyyy-MM-dd", { locale: zhCN }) : "结束日期"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={value?.end}
                  onSelect={(date) => handleFilterChange(field.key, { ...value, end: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )

      case 'number':
        return (
          <Input
            type="number"
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleFilterChange(field.key, e.target.value)}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 搜索栏 */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {fields.length > 0 && (
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="relative">
                <Filter className="mr-2 h-4 w-4" />
                筛选
                {showFilterCount && activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">筛选条件</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-8 px-2"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    重置
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label className="text-sm font-medium">
                        {field.label}
                      </Label>
                      {renderFilterField(field)}
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* 活动筛选器标签 */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(localFilters).map(([key, value]) => {
            if (value === undefined || value === null || value === '') return null
            if (Array.isArray(value) && value.length === 0) return null

            const field = fields.find(f => f.key === key)
            if (!field) return null

            let displayValue = value
            if (field.type === 'select' && field.options) {
              const option = field.options.find(opt => opt.value === value)
              displayValue = option?.label || value
            } else if (field.type === 'date-range' && value.start && value.end) {
              displayValue = `${format(value.start, "MM-dd")} ~ ${format(value.end, "MM-dd")}`
            }

            return (
              <Badge key={key} variant="secondary" className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{field.label}:</span>
                {displayValue}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => handleFilterChange(key, field.defaultValue || '')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
} 