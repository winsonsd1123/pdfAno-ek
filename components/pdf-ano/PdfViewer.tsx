"use client"

import React, { useCallback, useEffect, useRef, useState } from 'react'
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
    isManualAnnotationMode,
    addManualAnnotation,
    setCurrentPage,  // 新增：引入 setCurrentPage
  } = usePdfAnoContext()

  // 新增：页面可见度观察器
  const pageObserverRef = useRef<IntersectionObserver | null>(null)
  const pageVisibilityMap = useRef<Map<number, number>>(new Map())  // 存储每个页面的可见度

  // 新增：更新当前页码的函数
  const updateCurrentPage = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      const pageNumber = parseInt(entry.target.getAttribute('data-page') || '1')
      pageVisibilityMap.current.set(pageNumber, entry.intersectionRatio)
    })

    // 找出可见度最高的页面
    let maxVisibility = 0
    let mostVisiblePage = 1
    pageVisibilityMap.current.forEach((visibility, pageNumber) => {
      if (visibility > maxVisibility) {
        maxVisibility = visibility
        mostVisiblePage = pageNumber
      }
    })

    // 只有当页面可见度超过阈值时才更新当前页码
    if (maxVisibility > 0.3) {  // 30% 可见度阈值
      setCurrentPage(mostVisiblePage)
    }
  }, [setCurrentPage])

  // 新增：初始化 Intersection Observer
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    pageObserverRef.current = new IntersectionObserver(updateCurrentPage, {
      root: containerRef.current,
      threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    })

    return () => {
      if (pageObserverRef.current) {
        pageObserverRef.current.disconnect()
      }
    }
  }, [containerRef, updateCurrentPage])

  // 新增：观察页面元素
  const observePage = useCallback((pageNumber: number) => {
    const canvas = pageRefs.current.get(pageNumber)
    if (canvas && pageObserverRef.current) {
      canvas.setAttribute('data-page', pageNumber.toString())
      pageObserverRef.current.observe(canvas)
    }
  }, [])

  // 新增：绘制层的 refs 管理
  const drawingCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  
  // 新增：绘制状态管理
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [currentPageIndex, setCurrentPageIndex] = useState<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastMoveTimeRef = useRef<number>(0)

  // 新增：Canvas稳定性检查函数
  const waitForCanvasReady = useCallback(async (pageNumber: number, maxWaitTime: number = 3000): Promise<boolean> => {
    const startTime = Date.now()
    
    return new Promise((resolve) => {
      const checkCanvas = () => {
        const canvas = pageRefs.current.get(pageNumber)
        const elapsed = Date.now() - startTime
        
        // 检查是否超时
        if (elapsed > maxWaitTime) {
          console.warn(`Canvas ${pageNumber} not ready after ${maxWaitTime}ms`)
          resolve(false)
          return
        }
        
        // 检查canvas是否存在且有有效尺寸
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          console.log(`Canvas ${pageNumber} ready: ${canvas.width}x${canvas.height}`)
          resolve(true)
        } else {
          // 继续等待
          setTimeout(checkCanvas, 50)
        }
      }
      
      checkCanvas()
    })
  }, [])

  // 修改：在页面渲染后开始观察
  useEffect(() => {
    if (pdfRenderer.current && containerRef.current) {
      pdfRenderer.current.setContainer(containerRef.current)
      pdfRenderer.current.setupLazyLoading()
      
      // 主动渲染第一页，防止懒加载在刷新时失效
      const firstPageCanvas = pageRefs.current.get(1)
      if (firstPageCanvas) {
        pdfRenderer.current.renderPage(1)
        observePage(1)  // 新增：观察第一页
      }
    }
  }, [pdfRenderer, containerRef, pageRefs, observePage])

  // 修改：在新页面渲染时开始观察
  const ensurePageRendered = useCallback(async (pageNumber: number): Promise<boolean> => {
    if (pdfRenderer.current) {
      try {
        await pdfRenderer.current.renderPage(pageNumber)
        observePage(pageNumber)  // 新增：观察新渲染的页面
        return await waitForCanvasReady(pageNumber)
      } catch (err) {
        console.error(`Failed to render page ${pageNumber}:`, err)
        return false
      }
    }
    return false
  }, [waitForCanvasReady, observePage])

  const calculateDisplayPosition = useCallback((coordinates: Annotation['coordinates'], canvas: HTMLCanvasElement) => {
    return calculateDisplayPositionUtil(coordinates, canvas, scale)
  }, [scale])

  // 新增：同步绘制层尺寸
  const syncDrawingCanvasSize = useCallback((pageNumber: number) => {
    const pdfCanvas = pageRefs.current.get(pageNumber)
    const drawingCanvas = drawingCanvasRefs.current.get(pageNumber)
    if (pdfCanvas && drawingCanvas) {
      drawingCanvas.width = pdfCanvas.width
      drawingCanvas.height = pdfCanvas.height
      drawingCanvas.style.width = pdfCanvas.style.width
      drawingCanvas.style.height = pdfCanvas.style.height
    }
  }, [])

  // 新增：清除绘制层
  const clearDrawingCanvas = useCallback((pageNumber: number) => {
    const drawingCanvas = drawingCanvasRefs.current.get(pageNumber)
    if (drawingCanvas) {
      const ctx = drawingCanvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height)
      }
    }
  }, [])

  // 新增：在绘制层上画矩形 (优化版本，防止闪烁)
  const drawRectOnCanvas = useCallback((pageNumber: number, rect: { x: number; y: number; width: number; height: number }) => {
    // 取消之前的动画帧
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    // 使用 requestAnimationFrame 优化绘制
    animationFrameRef.current = requestAnimationFrame(() => {
      const drawingCanvas = drawingCanvasRefs.current.get(pageNumber)
      if (drawingCanvas) {
        const ctx = drawingCanvas.getContext('2d')
        if (ctx) {
          // 一次性完成清除和绘制，减少闪烁
          ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height)
          
          // 设置绘制样式
          ctx.save()
          ctx.strokeStyle = '#3b82f6'
          ctx.lineWidth = 2
          ctx.setLineDash([5, 5])
          
          // 先画填充，再画边框，避免重叠问题
          ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
          ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
          ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
          
          ctx.restore()
        }
      }
    })
  }, [])

  // 新增：处理鼠标按下事件
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>, pageNumber: number) => {
    if (!isManualAnnotationMode) return
    
    event.preventDefault()
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    
    const x = (event.clientX - rect.left) * (canvas.width / rect.width)
    const y = (event.clientY - rect.top) * (canvas.height / rect.height)
    
    setIsDrawing(true)
    setStartPoint({ x, y })
    setCurrentPageIndex(pageNumber - 1) // pageNumber 是从1开始的，pageIndex 是从0开始的
    setCurrentRect({ x, y, width: 0, height: 0 })
  }, [isManualAnnotationMode])

  // 新增：处理鼠标移动事件 (带节流优化)
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>, pageNumber: number) => {
    if (!isDrawing || !startPoint || !isManualAnnotationMode) return
    
    // 简单的时间节流，限制更新频率到 60fps
    const now = Date.now()
    if (now - lastMoveTimeRef.current < 16) return // 16ms ≈ 60fps
    lastMoveTimeRef.current = now
    
    event.preventDefault()
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    
    const currentX = (event.clientX - rect.left) * (canvas.width / rect.width)
    const currentY = (event.clientY - rect.top) * (canvas.height / rect.height)
    
    const newRect = {
      x: Math.min(startPoint.x, currentX),
      y: Math.min(startPoint.y, currentY),
      width: Math.abs(currentX - startPoint.x),
      height: Math.abs(currentY - startPoint.y)
    }
    
    setCurrentRect(newRect)
    drawRectOnCanvas(pageNumber, newRect)
  }, [isDrawing, startPoint, isManualAnnotationMode, drawRectOnCanvas])

  // 新增：处理鼠标松开事件
  const handleMouseUp = useCallback(async (event: React.MouseEvent<HTMLCanvasElement>, pageNumber: number) => {
    if (!isDrawing || !currentRect || !isManualAnnotationMode || currentPageIndex === null) return
    
    event.preventDefault()
    
    // 检查矩形大小，避免误触
    if (currentRect.width < 10 || currentRect.height < 10) {
      clearDrawingCanvas(pageNumber)
      setIsDrawing(false)
      setStartPoint(null)
      setCurrentRect(null)
      setCurrentPageIndex(null)
      return
    }
    
    try {
      // 将canvas坐标转换为viewport坐标（scale=1的基准）
      const pdfCanvas = pageRefs.current.get(pageNumber)
      if (pdfCanvas) {
        const scaleRatio = scale / 1
        const viewportRect = {
          x: currentRect.x / scaleRatio,
          y: currentRect.y / scaleRatio,
          width: currentRect.width / scaleRatio,
          height: currentRect.height / scaleRatio
        }
        
        // 调用Context方法创建批注
        await addManualAnnotation(currentPageIndex, viewportRect)
      }
    } catch (err) {
      console.error("Failed to create manual annotation:", err)
    } finally {
      // 清理状态
      clearDrawingCanvas(pageNumber)
      setIsDrawing(false)
      setStartPoint(null)
      setCurrentRect(null)
      setCurrentPageIndex(null)
    }
  }, [isDrawing, currentRect, isManualAnnotationMode, currentPageIndex, clearDrawingCanvas, scale, addManualAnnotation])

  // 新增：取消当前绘制
  const cancelDrawing = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (isDrawing && currentPageIndex !== null) {
      clearDrawingCanvas(currentPageIndex + 1)
      setIsDrawing(false)
      setStartPoint(null)
      setCurrentRect(null)
      setCurrentPageIndex(null)
    }
  }, [isDrawing, currentPageIndex, clearDrawingCanvas])

  // 新增：键盘事件处理（ESC取消绘制）
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isManualAnnotationMode) {
        cancelDrawing()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isManualAnnotationMode, cancelDrawing])

  // 新增：处理鼠标离开canvas事件
  const handleMouseLeave = useCallback(() => {
    if (isDrawing && isManualAnnotationMode) {
      cancelDrawing()
    }
  }, [isDrawing, isManualAnnotationMode, cancelDrawing])

  // 简单的防抖函数实现
  function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout | null = null
    return ((...args: any[]) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }) as T
  }

  // 新增：全局标注框重新计算机制
  const recalculateVisibleAnnotations = useCallback(async () => {
    if (!containerRef.current) return
    
    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const containerTop = container.scrollTop
    const containerBottom = containerTop + containerRect.height
    
    // 找出当前可见的页面
    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      const pageElement = document.getElementById(`page-${pageNumber}`)
      if (pageElement) {
        const pageRect = pageElement.getBoundingClientRect()
        const pageOffsetTop = pageElement.offsetTop
        const pageOffsetBottom = pageOffsetTop + pageElement.offsetHeight
        
        // 检查页面是否在可视区域内
        if (pageOffsetTop < containerBottom && pageOffsetBottom > containerTop) {
          // 页面可见，检查其canvas是否稳定
          const canvas = pageRefs.current.get(pageNumber)
          if (canvas && canvas.width > 0 && canvas.height > 0) {
            console.log(`Page ${pageNumber} is visible and canvas is stable`)
          }
        }
      }
    }
  }, [numPages])

  // 防抖处理的重新计算函数
  const debouncedRecalculate = useCallback(
    debounce(recalculateVisibleAnnotations, 200),
    [recalculateVisibleAnnotations]
  )

  // 监听容器滚动事件
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      const handleScroll = () => {
        debouncedRecalculate()
      }
      
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [debouncedRecalculate])

  // 监听scale变化，同步绘制层尺寸并重新计算标注框
  useEffect(() => {
    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      syncDrawingCanvasSize(pageNumber)
    }
    
    // 缩放变化后，延迟重新计算可见标注框位置
    setTimeout(() => {
      recalculateVisibleAnnotations()
    }, 300) // 给PDF重新渲染一些时间
  }, [scale, numPages, syncDrawingCanvasSize, recalculateVisibleAnnotations])

  // 组件卸载时清理动画帧
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // 当选中注释变化时，滚动到对应页面并等待Canvas稳定
  useEffect(() => {
    if (selectedAnnotation) {
      const handleAnnotationSelection = async () => {
        const pageNumber = selectedAnnotation.pageIndex + 1
        const pageElement = document.getElementById(`page-${pageNumber}`)
        
        if (pageElement) {
          // 先滚动到页面
          pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          
          // 等待滚动完成和页面渲染稳定
          setTimeout(async () => {
            const isReady = await ensurePageRendered(pageNumber)
            if (isReady) {
              console.log(`Annotation ${selectedAnnotation.id} ready to display on page ${pageNumber}`)
              // Canvas已经稳定，React会自动重新渲染标注框，无需强制触发
            } else {
              console.error(`Failed to prepare canvas for annotation ${selectedAnnotation.id} on page ${pageNumber}`)
            }
          }, 500) // 给滚动动画一些时间
        }
      }
      
      handleAnnotationSelection()
    }
  }, [selectedAnnotation, ensurePageRendered])

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
                if (el && pageObserverRef.current) {
                  pageObserverRef.current.observe(el)
                }
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

              {/* 新增：绘制层 Canvas */}
              <canvas
                ref={(canvas) => {
                  if (canvas) {
                    drawingCanvasRefs.current.set(pageNumber, canvas)
                    // 初始化时同步尺寸
                    setTimeout(() => syncDrawingCanvasSize(pageNumber), 0)
                  }
                }}
                className={`absolute top-0 left-0 w-full h-full pointer-events-auto ${
                  isManualAnnotationMode ? 'cursor-crosshair' : 'cursor-default pointer-events-none'
                }`}
                style={{ 
                  display: "block",
                  zIndex: 10,
                  userSelect: isManualAnnotationMode ? 'none' : 'auto' // 防止文字选择
                }}
                onMouseDown={(e) => handleMouseDown(e, pageNumber)}
                onMouseMove={(e) => handleMouseMove(e, pageNumber)}
                onMouseUp={(e) => handleMouseUp(e, pageNumber)}
                onMouseLeave={handleMouseLeave}
                onContextMenu={(e) => e.preventDefault()} // 防止右键菜单
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
                        style={{
                          ...style,
                          zIndex: 5 // 确保注释显示在绘制层下面
                        }}
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
                        zIndex: 5 // 确保搜索高亮显示在绘制层下面
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
