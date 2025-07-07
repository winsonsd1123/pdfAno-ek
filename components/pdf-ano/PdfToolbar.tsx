"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, MessageSquare, ZoomIn, ZoomOut, MapPin } from "lucide-react"
import { usePdfAnoContext } from "@/contexts/PdfAnoContext"

interface PdfToolbarProps {
  docName: string
  onToggleDebugPanel: () => void
  showDebugPanel: boolean
}

export function PdfToolbar({ docName, onToggleDebugPanel, showDebugPanel }: PdfToolbarProps) {
  const {
    numPages,
    scale,
    performAutoAnnotation,
    isAutoAnnotating,
    autoAnnotationProgress,
    zoomIn,
    zoomOut,
    debugInfo,
    pdfDoc,
  } = usePdfAnoContext()

  return (
    <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-700" />
          <span className="font-medium text-gray-900 max-w-xs truncate" title={docName}>
            {docName}
          </span>
        </div>
        <Badge variant="outline">{numPages} pages</Badge>
        <Badge variant="outline">Scale: {Math.round(scale * 100)}%</Badge>
        {autoAnnotationProgress && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 max-w-xs truncate">
            {autoAnnotationProgress}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={performAutoAnnotation}
          size="sm"
          variant="outline"
          disabled={isAutoAnnotating || !pdfDoc}
          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
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
        <Button onClick={zoomOut} size="sm" variant="outline">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button onClick={zoomIn} size="sm" variant="outline">
          <ZoomIn className="w-4 h-4" />
        </Button>
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