"use client"

import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * 表格列定义接口
 */
export interface DataTableColumn<T> {
  key: (keyof T) | (string & {}); // 允许多余的字符串key，同时保留keyof T的类型提示
  title: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, record: T, index: number) => React.ReactNode
  width?: string
  className?: string
}

/**
 * 分页配置接口
 */
export interface PaginationConfig {
  page: number
  limit: number
  total: number
  showSizeChanger?: boolean
  pageSizes?: number[]
}

/**
 * 排序配置接口
 */
export interface SortConfig {
  key: string
  order: 'asc' | 'desc'
}

/**
 * DataTable 组件属性
 */
export interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  loading?: boolean
  pagination?: PaginationConfig
  onPaginationChange?: (page: number, limit: number) => void
  onSort?: (sortConfig: SortConfig | null) => void
  selectable?: boolean
  selectedRows?: T[]
  onSelectionChange?: (selectedRows: T[]) => void
  rowKey?: keyof T | ((record: T) => string | number)
  onRowClick?: (record: T, index: number) => void
  emptyText?: string
  className?: string
}

/**
 * 管理后台数据表格组件
 * 
 * 特性：
 * - 支持排序、分页、多选
 * - 自定义渲染列内容
 * - 响应式设计
 * - 加载状态展示
 */
export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  pagination,
  onPaginationChange,
  onSort,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  rowKey = 'id',
  onRowClick,
  emptyText = '暂无数据',
  className,
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')

  // 获取行的唯一键值
  const getRowKey = (record: T): string | number => {
    if (typeof rowKey === 'function') {
      return rowKey(record)
    }
    return record[rowKey]
  }

  // 处理排序
  const handleSort = (columnKey: string) => {
    let newSortConfig: SortConfig | null = null
    
    if (!sortConfig || sortConfig.key !== columnKey) {
      newSortConfig = { key: columnKey, order: 'asc' }
    } else if (sortConfig.order === 'asc') {
      newSortConfig = { key: columnKey, order: 'desc' }
    } else {
      newSortConfig = null
    }
    
    setSortConfig(newSortConfig)
    onSort?.(newSortConfig)
  }

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange?.(data)
    } else {
      onSelectionChange?.([])
    }
  }

  // 处理单行选择
  const handleRowSelect = (record: T, checked: boolean) => {
    const currentRowKey = getRowKey(record)
    if (checked) {
      onSelectionChange?.([...selectedRows, record])
    } else {
      onSelectionChange?.(
        selectedRows.filter(row => getRowKey(row) !== currentRowKey)
      )
    }
  }

  // 检查是否选中
  const isRowSelected = (record: T) => {
    const currentRowKey = getRowKey(record)
    return selectedRows.some(row => getRowKey(row) === currentRowKey)
  }

  // 检查是否全选
  const isAllSelected = data.length > 0 && data.every(record => isRowSelected(record))
  const isIndeterminate = selectedRows.length > 0 && !isAllSelected

  // 渲染排序图标
  const renderSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />
    }
    
    return sortConfig.order === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4 text-primary" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 text-primary" />
    )
  }

  // 渲染分页控件
  const renderPagination = () => {
    if (!pagination) return null

    const { page, limit, total } = pagination
    const totalPages = Math.ceil(total / limit)
    const startRecord = (page - 1) * limit + 1
    const endRecord = Math.min(page * limit, total)

    return (
      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-sm text-muted-foreground">
          共 {total} 条记录
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">每页</p>
            <select
              value={limit}
              onChange={(e) => onPaginationChange?.(1, Number(e.target.value))}
              className="h-8 w-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {[10, 20, 30, 50].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            {page}/{totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => onPaginationChange?.(1, limit)}
              disabled={page <= 1}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onPaginationChange?.(page - 1, limit)}
              disabled={page <= 1}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onPaginationChange?.(page + 1, limit)}
              disabled={page >= totalPages}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => onPaginationChange?.(totalPages, limit)}
              disabled={page >= totalPages}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    className={isIndeterminate ? "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground" : ""}
                  />
                </TableHead>
              )}
              {columns.map((column, index) => (
                <TableHead
                  key={String(column.key)}
                  className={cn(
                    column.className,
                    column.sortable && "cursor-pointer select-none hover:bg-muted/50"
                  )}
                  style={{ width: column.width }}
                  onClick={column.sortable ? () => handleSort(String(column.key)) : undefined}
                >
                  <div className="flex items-center">
                    {column.title}
                    {column.sortable && renderSortIcon(String(column.key))}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (selectable ? 1 : 0)} 
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>加载中...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (selectable ? 1 : 0)} 
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              data.map((record, index) => (
                <TableRow
                  key={getRowKey(record)}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    isRowSelected(record) && "bg-muted/50"
                  )}
                  onClick={onRowClick ? () => onRowClick(record, index) : undefined}
                >
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={isRowSelected(record)}
                        onCheckedChange={(checked) => handleRowSelect(record, checked as boolean)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className={column.className}
                    >
                      {column.render
                        ? column.render(record[column.key], record, index)
                        : record[column.key]
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {renderPagination()}
    </div>
  )
} 