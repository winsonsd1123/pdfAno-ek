"use client"

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, MessageSquare, ZoomIn, ZoomOut, MapPin, Pencil, Download } from "lucide-react"
import { usePdfAnoContext } from "@/contexts/PdfAnoContext"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface PdfToolbarProps {
  docName: string
  onToggleDebugPanel: () => void
  showDebugPanel: boolean
}

export function PdfToolbar({ docName, onToggleDebugPanel, showDebugPanel }: PdfToolbarProps) {
  const {
    numPages,
    currentPage,
    scale,
    performAutoAnnotation,
    isAutoAnnotating,
    autoAnnotationProgress,
    zoomIn,
    zoomOut,
    debugInfo,
    pdfDoc,
    isManualAnnotationMode,
    toggleManualAnnotationMode,
    annotations, // 获取批注数据
    docUrl,      // 获取文档URL
  } = usePdfAnoContext()

  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    const toastId = toast.loading("正在导出PDF，请稍候...")

    try {
      // 处理批注数据，合并 DESCRIPTION 和 SUGGESTION
      const processedAnnotations = annotations.map(anno => ({
        ...anno,
        content: anno.aiAnnotation 
          ? `${anno.aiAnnotation.originalData.description || ''}\n\n${anno.aiAnnotation.originalData.suggestion || ''}`
          : anno.content
      }))

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: docUrl,
          annotations: processedAnnotations,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '导出失败')
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('content-disposition')
      
      // 优先从后端响应头获取文件名，如果获取不到，则使用安全的默认名
      let exportFilename = 'exported_annotated_document.pdf'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
        if (filenameMatch && filenameMatch[1]) {
          exportFilename = filenameMatch[1]
        }
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success("导出成功！", { id: toastId })

    } catch (error) {
      console.error("导出PDF失败:", error)
      toast.error(error instanceof Error ? error.message : "发生未知错误", { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }


  return (
    <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-700" />
          <span className="font-medium text-gray-900 max-w-xs truncate" title={docName}>
            {docName}
          </span>
        </div>
        <Badge variant="outline">{currentPage} / {numPages}</Badge>
        {autoAnnotationProgress && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 max-w-xs truncate">
            {autoAnnotationProgress}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={toggleManualAnnotationMode}
          size="sm"
          variant="outline"
          disabled={!pdfDoc}
          className={`${isManualAnnotationMode ? "bg-blue-100 text-blue-700" : ""}`}
        >
          <Pencil className="w-4 h-4 mr-2" />
          手动批注
        </Button>
        <Button
          onClick={performAutoAnnotation}
          size="sm"
          variant="outline"
          disabled={isAutoAnnotating || !pdfDoc}
          className="hover:bg-blue-100 text-blue-700 border-blue-200"
        >
          {isAutoAnnotating ? (
            <>
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
              AI批注中...
            </>
          ) : (
            <>
              <MessageSquare className="w-4 h-4 mr-2" />
              AI自动批注
            </>
          )}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={isExporting || !pdfDoc}
              className="hover:bg-green-100 text-green-700 border-green-200"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin mr-2" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  导出PDF
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认导出</AlertDialogTitle>
              <AlertDialogDescription>
                您确定要导出带有批注的PDF文件吗？此操作根据文件大小和批注数量，可能需要一些时间。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleExport}>确认导出</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="flex items-center">
          <Button onClick={zoomOut} size="sm" variant="outline">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="w-12 text-center text-sm text-gray-600">{Math.round(scale * 100)}%</span>
          <Button onClick={zoomIn} size="sm" variant="outline">
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
        {debugInfo.length > 0 && (
          <Button
            onClick={onToggleDebugPanel}
            size="sm"
            variant="outline"
            className={`${showDebugPanel ? "bg-blue-100 text-blue-700" : ""}`}
          >
            <MapPin className="w-4 h-4 mr-2" />
            调试信息 ({debugInfo.length})
          </Button>
        )}
      </div>
    </div>
  )
} 