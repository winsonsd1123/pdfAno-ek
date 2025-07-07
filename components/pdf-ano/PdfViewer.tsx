"use client"

import React, { useCallback, useEffect } from 'react'
import { usePdfAnoContext } from '@/contexts/PdfAnoContext'
import { calculateDisplayPosition as calculateDisplayPositionUtil } from "@/lib/pdf-coordinate-utils"
import type { Annotation } from '@/types/pdf-annotation'

export function PdfViewer() {
  const {
    containerRef,
    numPages,
    pdfRenderer,
    pageRefs,
    annotations,
    selectedAnnotation,
    setSelectedAnnotation,
    scrollToAnnotationItem,
    searchResults,
    currentSearchIndex,
    scale,
  } = usePdfAnoContext()

  // 当渲染器和容器都准备好后，进行设置
  useEffect(() => {
    if (pdfRenderer.current && containerRef.current) {
      pdfRenderer.current.setContainer(containerRef.current);
      pdfRenderer.current.setupLazyLoading();
      
      // 主动渲染第一页，防止懒加载在刷新时失效
      const firstPageCanvas = pageRefs.current.get(1);
      if (firstPageCanvas) {
         pdfRenderer.current.renderPage(1);
      }
    }
  }, [pdfRenderer, containerRef, pageRefs]);

  const calculateDisplayPosition = useCallback((coordinates: Annotation['coordinates'], canvas: HTMLCanvasElement) => {
    return calculateDisplayPositionUtil(coordinates, canvas, scale)
  }, [scale])

  return (
    <div ref={containerRef} className="flex-1 overflow-auto p-4 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-4">
        {Array.from({ length: numPages }, (_, index) => {
          const pageNumber = index + 1
          return (
            <div
              key={pageNumber}
              id={`page-${pageNumber}`}
              data-page={pageNumber}
              className="relative bg-white shadow-lg"
              ref={(el) => {
                if (el && pdfRenderer.current) {
                  pdfRenderer.current.observePage(el)
                }
              }}
            >
              <canvas
                ref={(canvas) => {
                  if (canvas) {
                    pageRefs.current.set(pageNumber, canvas)
                    if (pdfRenderer.current) {
                      pdfRenderer.current.setPageRef(pageNumber, canvas)
                    }
                  }
                }}
                className="w-full cursor-default"
                style={{ display: "block" }}
              />

              {/* 渲染注释 */}
              {annotations
                .filter((annotation) => annotation.pageIndex === index)
                .map((annotation) => {
                  const canvas = pageRefs.current.get(pageNumber)
                  if (!canvas) return null

                  if (annotation.coordinates) {
                    const style = calculateDisplayPosition(annotation.coordinates, canvas)
                    return (
                      <div
                        key={annotation.id}
                        className={`absolute border-2 rounded cursor-pointer transition-colors ${
                          annotation.type === "highlight"
                            ? "bg-yellow-200 bg-opacity-30 border-red-400 hover:bg-yellow-300 hover:bg-opacity-40"
                            : "bg-blue-200 bg-opacity-30 border-red-400 hover:bg-blue-300 hover:bg-opacity-40"
                        } ${selectedAnnotation?.id === annotation.id ? "ring-2 ring-blue-500" : ""}`}
                        style={style}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedAnnotation(annotation)
                          scrollToAnnotationItem(annotation.id)
                        }}
                        title={annotation.aiAnnotation?.originalData.title || annotation.content}
                      />
                    )
                  }
                  return null // Fallback for annotations without coordinates
                })}

              {/* 渲染搜索高亮 */}
              {searchResults
                .filter((result) => result.pageIndex === index)
                .map((result, resultIndex) => {
                  const isCurrentResult = searchResults.indexOf(result) === currentSearchIndex
                  const canvas = pageRefs.current.get(pageNumber)
                  if (!canvas) return null

                  const currentViewport = { width: canvas.width, height: canvas.height }
                  const scaleRatio = scale / 1 // from scale=1 to current
                  const highlightX = result.coordinates.viewportCoordinates.x * scaleRatio
                  const highlightY = result.coordinates.viewportCoordinates.y * scaleRatio
                  const highlightWidth = result.coordinates.viewportCoordinates.width * scaleRatio
                  const highlightHeight = (result.coordinates.viewportCoordinates.height * scaleRatio) * 1.2

                  return (
                    <div
                      key={resultIndex}
                      className={`absolute pointer-events-none ${
                        isCurrentResult ? "bg-yellow-300 bg-opacity-40 border-red-500" : "bg-yellow-200 bg-opacity-30 border-red-400"
                      } border-2`}
                      style={{
                        left: `${(highlightX / currentViewport.width) * 100}%`,
                        top: `${(highlightY / currentViewport.height) * 100}%`,
                        width: `${(highlightWidth / currentViewport.width) * 100}%`,
                        height: `${(highlightHeight / currentViewport.height) * 100}%`,
                      }}
                    >
                       {isCurrentResult && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {searchResults.indexOf(result) + 1}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )
} 