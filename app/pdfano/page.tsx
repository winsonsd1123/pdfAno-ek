"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, MessageSquare, ZoomIn, ZoomOut, MapPin, FileText } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { 
  mergeAnnotationContent, 
  addDefaultAuthorInfo, 
  getCurrentTimestamp,
  formatTimestamp,
  type AnnotationRole 
} from "@/lib/annotation-utils"
import { AnnotationBubble, AnnotationContent, AnnotationHeader, AnnotationBody } from "@/components/ui/annotation-bubble"
import { AnnotationIcon, AnnotationAuthorName } from "@/components/ui/annotation-icon"
import { QuotedText } from "@/components/ui/quoted-text"

// 导入PDF工具模块
import { loadPDFDocument } from "@/lib/pdf-loader"
import { createPDFRenderer, ScaleController } from "@/lib/pdf-renderer"
import { createTextExtractor } from "@/lib/pdf-text-extractor"
import { 
  createCoordinatesFromClick as createCoordinatesFromClickUtil,
  createCoordinatesFromLegacy as createCoordinatesFromLegacyUtil,
  calculateDisplayPosition as calculateDisplayPositionUtil 
} from "@/lib/pdf-coordinate-utils"
// 导入AI批注服务模块
import { createAIAnnotationService, type AIAnnotationService } from "@/lib/ai-annotation-service"
// 简化版PDF类型定义（避免重复导入）
type PDFDocumentProxy = any
type PDFPageProxy = any  
type PDFPageViewport = any
type PDFRenderTask = any
type SearchResult = any

// 应用特定的接口定义（业务逻辑相关）

interface AnnotationReply {
  id: string
  author: {
    name: string
    role: "AI助手" | "手动批注者" | "导师" | "同学"
    avatar?: string
    color: string
  }
  content: string
  timestamp: string
  // 新增：编辑状态
  isEditing?: boolean
}

interface Annotation {
  id: string
  pageIndex: number
  // 标记为deprecated，但保留以支持迁移
  x?: number
  y?: number
  width?: number
  height?: number
  content: string
  type: "highlight" | "note"
  // 新增字段
  author: {
    name: string
    role: "AI助手" | "手动批注者" | "导师" | "同学"
    avatar?: string
    color: string
  }
  timestamp: string
  isExpanded?: boolean // 控制展开/折叠状态
  // 修改AI批注结构
  aiAnnotation?: {
    selectedText: string
    mergedContent: string // 合并后的教师点评风格内容
    originalData: {
      title: string
      description: string
      suggestion: string
      annotationType: string
      severity: string
    }
  }
  // 新增：批注回复
  replies?: AnnotationReply[]
  // 统一的坐标信息 - 现在是必需字段
  coordinates: {
    pdfCoordinates: {
      x: number
      y: number
      width: number
      height: number
    }
    viewportCoordinates: {
      x: number
      y: number
      width: number
      height: number
    }
    pageSize: {
      width: number
      height: number
    }
  }
  // 新增：编辑状态
  isEditing?: boolean
}

export default function PdfAnoPage() {
  const searchParams = useSearchParams()
  
  // 从URL参数获取文档信息
  const docUrl = searchParams.get('url')
  const docName = searchParams.get('name') || 'Unknown Document'
  const docId = searchParams.get('docId')
  
  // 如果没有提供URL，使用默认的PDF
  const PDF_URL = docUrl || "https://xpzbccdjc5ty6al1.public.blob.vercel-storage.com/advertisement-computing-rrttEVTmdSQcWy9D17QnNq77h49KFV.pdf"
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.5)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCoordinates, setShowCoordinates] = useState(false)
  const [mouseCoordinates, setMouseCoordinates] = useState<{
    pageIndex: number
    pdfCoords: { x: number; y: number }
    viewportCoords: { x: number; y: number }
    pageSize: { width: number; height: number }
  } | null>(null)
  const [panelWidth, setPanelWidth] = useState(() => {
    // 初始化时设置为最大宽度(600px或窗口宽度的50%中的较小值)
    if (typeof window !== 'undefined') {
      return Math.min(600, window.innerWidth * 0.5);
    }
    return 600; // 服务器端渲染时的默认值
  })
  const [isResizing, setIsResizing] = useState(false)
  const [isAutoAnnotating, setIsAutoAnnotating] = useState(false)
  const [autoAnnotationProgress, setAutoAnnotationProgress] = useState("")
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null)
  const [editingDescription, setEditingDescription] = useState("")
  const [editingSuggestion, setEditingSuggestion] = useState("")
  const [debugInfo, setDebugInfo] = useState<Array<{
    text: string
    page: number
    found: boolean
    coordinates?: {
      viewport: { x: string; y: string }
      pdf: { x: string; y: string }
      size: { w: string; h: string }
      pageSize: { w: string; h: string }
    }
    fallbackCoordinates?: { x: number; y: number }
    actualPage?: number
    searchStrategy?: string
  }>>([])
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [activeTab, setActiveTab] = useState("search")
  const [editingContent, setEditingContent] = useState("")

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  
  // PDF渲染器相关的refs  
  const pdfRenderer = useRef<ReturnType<typeof createPDFRenderer> | null>(null)
  const textExtractor = useRef<ReturnType<typeof createTextExtractor> | null>(null)
  
  // AI批注服务ref
  const aiAnnotationService = useRef<AIAnnotationService | null>(null)
  

  
  // 简化的向后兼容refs
  const renderedPages = useRef<Set<number>>(new Set())
  const renderTasks = useRef<Map<number, PDFRenderTask>>(new Map())

  // 添加批注面板滚动容器的ref
  const annotationPanelRef = useRef<HTMLDivElement>(null)
  // 添加批注项ref映射
  const annotationItemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // 批注排序函数 - 使用PDF.js坐标信息进行排序
  const sortAnnotations = useCallback((annotations: Annotation[]): Annotation[] => {
    return [...annotations].sort((a, b) => {
      // 首先按页面排序
      if (a.pageIndex !== b.pageIndex) {
        return a.pageIndex - b.pageIndex
      }
      
      // 在同一页面内，按Y坐标排序（从上到下）
      // 优先使用统一的coordinates信息
      if (a.coordinates && b.coordinates) {
        // 使用PDF坐标系统的Y坐标进行排序（PDF坐标系是从下往上的，所以较大的Y值在上方）
        return b.coordinates.pdfCoordinates.y - a.coordinates.pdfCoordinates.y
      }
      
      // 如果某个标注没有coordinates，尝试使用旧的坐标字段
      const aY = a.coordinates?.viewportCoordinates.y ?? a.y ?? 0
      const bY = b.coordinates?.viewportCoordinates.y ?? b.y ?? 0
      
      // 都没有详细坐标信息时，使用基础Y坐标（视口坐标系）
      return aY - bY
    })
  }, [])

  // 滚动到指定批注项的函数
  const scrollToAnnotationItem = useCallback((annotationId: string) => {
    const annotationElement = annotationItemRefs.current.get(annotationId)
    const panelElement = annotationPanelRef.current
    
    if (annotationElement && panelElement) {
      // 使用scrollIntoView方法，更准确地滚动到顶部
      annotationElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start', // 将元素滚动到容器顶部
        inline: 'nearest'
      })
      
      // 可选：添加高亮效果
      annotationElement.classList.add('animate-pulse')
      setTimeout(() => {
        annotationElement.classList.remove('animate-pulse')
      }, 1000)
    }
  }, [])

  // 使用工具模块的坐标转换函数（保持相同的接口）
  const createCoordinatesFromClick = useCallback(async (
    event: React.MouseEvent<HTMLCanvasElement>, 
    pageIndex: number,
    width: number = 200,
    height: number = 100
  ) => {
    if (!pdfDoc) return null
    return createCoordinatesFromClickUtil(event, pageIndex, pdfDoc, scale, width, height)
  }, [pdfDoc, scale])

  const calculateDisplayPosition = useCallback((coordinates: Annotation['coordinates'], canvas: HTMLCanvasElement) => {
    return calculateDisplayPositionUtil(coordinates, canvas, scale)
  }, [scale])

  const createCoordinatesFromLegacy = useCallback(async (
    annotation: { x: number, y: number, width: number, height: number, pageIndex: number }
  ) => {
    if (!pdfDoc) return null
    return createCoordinatesFromLegacyUtil(annotation, pdfDoc)
  }, [pdfDoc])

  // 使用新渲染器的页面渲染（简化版）
  const renderPage = useCallback(
    async (pageNumber: number) => {
      if (pdfRenderer.current) {
        await pdfRenderer.current.renderPage(pageNumber)
      }
      // 保持向后兼容的标记
      renderedPages.current.add(pageNumber)
    },
    [pdfRenderer],
  )

  // 使用新的PDF加载器加载PDF.js和文档
  useEffect(() => {
    const loadPdfDocument = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // 使用新的PDF加载器
        const pdf = await loadPDFDocument(PDF_URL)
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        
        // 初始化PDF工具实例
        pdfRenderer.current = createPDFRenderer(pdf, scale)
        textExtractor.current = createTextExtractor(pdf)
        
        // 设置容器引用和懒加载
        if (containerRef.current && pdfRenderer.current) {
          pdfRenderer.current.setContainer(containerRef.current)
          pdfRenderer.current.setupLazyLoading()
        }
        
        setLoading(false)
        console.log(`PDF加载成功：${pdf.numPages} 页，工具实例已初始化`)
      } catch (err: any) {
        console.error("PDF文档加载失败:", err)
        setError(err.message || "PDF文档加载失败")
        setLoading(false)
      }
    }

    loadPdfDocument()
  }, [])

  // 简化的懒加载设置（主要由PDF渲染器处理）
  useEffect(() => {
    if (!pdfDoc || !pdfRenderer.current) return

    // 确保新渲染器的懒加载已设置
    pdfRenderer.current.setupLazyLoading()

    // 保留简化的后备观察器（兼容性）
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNumber = Number.parseInt(entry.target.getAttribute("data-page") || "0")
            if (pageNumber) renderPage(pageNumber)
          }
        })
      },
      { rootMargin: "100px", threshold: 0.1 }
    )

    const pageElements = document.querySelectorAll("[data-page]")
    pageElements.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [pdfDoc, renderPage])

  // 搜索文本 - 使用新的文本提取器模块

  // 使用新的文本提取器进行搜索
  const searchText = useCallback(async (options?: {
    query?: string;
    targetPage?: number;
    returnFirst?: boolean;
  }) => {
    const queryText = options?.query || searchQuery
    const targetPage = options?.targetPage
    const returnFirst = options?.returnFirst || false
    
    if (!textExtractor.current || !queryText.trim()) {
      if (!returnFirst) {
        setSearchResults([])
      }
      return returnFirst ? null : undefined
    }

    try {
      // 使用新的文本提取器
      const results = await textExtractor.current.searchText({
        query: queryText,
        targetPage: targetPage,
        returnFirst
      })

      // 处理不同的返回类型
      if (returnFirst) {
        // 返回单个结果或null
        return results as any // 程序化搜索的返回格式
      } else {
        // UI搜索：返回数组
        const resultArray = Array.isArray(results) ? results : (results ? [results] : [])
        setSearchResults(resultArray)
        setCurrentSearchIndex(resultArray.length > 0 ? 0 : -1)
        return undefined
      }
    } catch (err) {
      console.error("使用文本提取器搜索失败:", err)
      return returnFirst ? null : undefined
    }
  }, [searchQuery, textExtractor])

  // 跳转到搜索结果
  const goToSearchResult = useCallback(
    (index: number) => {
      if (index < 0 || index >= searchResults.length) return

      const result = searchResults[index]
      const pageElement = document.getElementById(`page-${result.pageIndex + 1}`)

      if (pageElement) {
        pageElement.scrollIntoView({ behavior: "smooth", block: "center" })
        setCurrentSearchIndex(index)
      }
    },
    [searchResults],
  )



  // 使用AI服务进行自动批注
  const performAutoAnnotation = useCallback(async () => {
    if (!aiAnnotationService.current || isAutoAnnotating) return

    setIsAutoAnnotating(true)
    setActiveTab("annotations") // 自动切换到批注标签页
    setAutoAnnotationProgress("正在启动AI批注...")
    setDebugInfo([]) // 清空调试信息
    setShowDebugPanel(false) // 隐藏调试面板

    try {
      const result = await aiAnnotationService.current.performAutoAnnotation()

      // 添加到批注列表
      setAnnotations(prev => [...prev, ...result])

      setAutoAnnotationProgress(`AI批注完成！共生成 ${result.length} 条批注`)
      
      // 5秒后清除进度信息
      setTimeout(() => {
        setAutoAnnotationProgress("")
      }, 5000)
    } catch (err: any) {
      console.error("Auto annotation error:", err)
      setAutoAnnotationProgress(`批注失败：${err.message}`)
      setDebugInfo([]) // 清空调试信息

      setTimeout(() => {
        setAutoAnnotationProgress("")
      }, 8000)
    } finally {
      setIsAutoAnnotating(false)
    }
  }, [aiAnnotationService.current, isAutoAnnotating])

  // 初始化AI批注服务
  useEffect(() => {
    if (!pdfDoc || !textExtractor.current) return
    
    aiAnnotationService.current = createAIAnnotationService({
      onDebugInfo: (info) => {
        setDebugInfo(info)
        setShowDebugPanel(true) // 自动显示调试面板
      }
    })
    aiAnnotationService.current.initialize(pdfDoc, textExtractor.current, searchText)
  }, [pdfDoc, textExtractor.current, searchText])

  // 缩放控制
  // 缩放控制器实例
  const scaleController = useRef(new ScaleController(1.5, 0.5, 3.0, 0.25))

  const zoomIn = () => {
    const newScale = scaleController.current.zoomIn()
    setScale(newScale)
  }

  const zoomOut = () => {
    const newScale = scaleController.current.zoomOut()
    setScale(newScale)
  }

  // 处理面板大小调整
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return

      const containerWidth = window.innerWidth
      const newWidth = containerWidth - e.clientX

      // 设置最小和最大宽度限制
      const minWidth = 280
      const maxWidth = Math.min(600, containerWidth * 0.5)

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setPanelWidth(newWidth)
      }
    },
    [isResizing],
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  // 添加窗口大小变化的监听，确保面板尺寸合理
  useEffect(() => {
    const handleResize = () => {
      const containerWidth = window.innerWidth;
      const maxAllowedWidth = Math.min(600, containerWidth * 0.5);
      
      // 在小屏幕上自动调整面板宽度
      if (containerWidth < 768) {
        const newWidth = Math.min(maxAllowedWidth, containerWidth * 0.8);
        setPanelWidth(newWidth);
      } 
      // 在初始化或窗口大小变化时，总是应用最大宽度限制
      else if (panelWidth < maxAllowedWidth) {
        setPanelWidth(maxAllowedWidth);
      }
      // 确保面板不会占据太多空间
      else if (panelWidth > containerWidth * 0.5) {
        setPanelWidth(maxAllowedWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    // 初始化时也调用一次，确保应用最大宽度
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [panelWidth]);

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Update the scale change effect to properly handle re-rendering
  // 监听scale变化，更新渲染器缩放
  useEffect(() => {
    if (pdfRenderer.current) {
      pdfRenderer.current.updateScale(scale)
      scaleController.current.setScale(scale)
    }
    // 清除旧的渲染状态
    renderedPages.current.clear()
  }, [scale])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      renderTasks.current.clear()
    }
  }, [])

  // 添加组件挂载时的初始化效果
  useEffect(() => {
    // 确保在组件挂载时立即设置为最大宽度
    const containerWidth = window.innerWidth;
    const maxAllowedWidth = Math.min(600, containerWidth * 0.5);
    setPanelWidth(maxAllowedWidth);
  }, []);

  // 添加编辑批注内容的函数
  const handleEditAnnotation = useCallback((annotation: Annotation, newContent: string) => {
    setAnnotations(prev => prev.map(a => 
      a.id === annotation.id 
        ? {
            ...a, 
            isEditing: false,
            content: newContent,
            aiAnnotation: a.aiAnnotation 
              ? { ...a.aiAnnotation, mergedContent: newContent }
              : undefined
          }
        : a
    ))
  }, [])

  // 添加编辑回复内容的函数
  const handleEditReply = useCallback((annotationId: string, replyId: string, newContent: string) => {
    setAnnotations(prev => prev.map(a => 
      a.id === annotationId
        ? {
            ...a,
            replies: a.replies?.map(r => 
              r.id === replyId
                ? { ...r, isEditing: false, content: newContent }
                : r
            )
          }
        : a
    ))
  }, [])

  // 切换批注编辑状态
  const toggleAnnotationEditMode = useCallback((annotation: Annotation) => {
    setEditingContent(annotation.aiAnnotation?.mergedContent || annotation.content)
    setAnnotations(prev => prev.map(a => 
      a.id === annotation.id
        ? { ...a, isEditing: !a.isEditing }
        : { ...a, isEditing: false } // 关闭其他批注的编辑模式
    ))
  }, [])

  // 切换回复编辑状态
  const toggleReplyEditMode = useCallback((annotationId: string, reply: AnnotationReply) => {
    setEditingContent(reply.content)
    setAnnotations(prev => prev.map(a => 
      a.id === annotationId
        ? {
            ...a,
            replies: a.replies?.map(r => 
              r.id === reply.id
                ? { ...r, isEditing: !r.isEditing }
                : { ...r, isEditing: false } // 关闭其他回复的编辑模式
            )
          }
        : a
    ))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading PDF...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 主要内容区域 - 移到左侧 */}
      <div className="flex-1 flex flex-col" style={{ marginRight: `${panelWidth}px` }}>
        {/* 工具栏 */}
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
            {mouseCoordinates && (
              <>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  Page {mouseCoordinates.pageIndex}
                </Badge>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  PDF: ({mouseCoordinates.pdfCoords.x.toFixed(1)}, {mouseCoordinates.pdfCoords.y.toFixed(1)})
                </Badge>
                <Badge variant="outline" className="bg-purple-50 text-purple-700">
                  Viewport: ({mouseCoordinates.viewportCoords.x.toFixed(1)},{" "}
                  {mouseCoordinates.viewportCoords.y.toFixed(1)})
                </Badge>
              </>
            )}
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
                onClick={() => setShowDebugPanel(!showDebugPanel)}
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

        {/* PDF查看区域 */}
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
                        // 同时设置到PDF渲染器
                        if (pdfRenderer.current) {
                          pdfRenderer.current.setPageRef(pageNumber, canvas)
                        }
                      }
                    }}
                    className="w-full cursor-default"
                    style={{ display: "block" }}
                  />

                  {/* 渲染注释 - 使用与搜索结果相同的坐标计算方法 */}
                  {annotations
                    .filter((annotation) => annotation.pageIndex === index)
                    .map((annotation) => {
                      const canvas = pageRefs.current.get(pageNumber)
                      if (!canvas) return null

                      // 如果有坐标信息，使用与搜索结果相同的计算方法
                      if (annotation.coordinates) {
                        const currentViewport = { width: canvas.width, height: canvas.height }
                        const scaleRatio = scale / 1 // 从scale=1转换到当前scale
                        const highlightX = annotation.coordinates.viewportCoordinates.x * scaleRatio
                        const highlightY = annotation.coordinates.viewportCoordinates.y * scaleRatio
                        const highlightWidth = annotation.coordinates.viewportCoordinates.width * scaleRatio
                        // 增加标注框的高度，确保完全覆盖文字
                        const highlightHeight = (annotation.coordinates.viewportCoordinates.height * scaleRatio) * 1.2

                        return (
                          <div
                            key={annotation.id}
                            className={`absolute border-2 rounded cursor-pointer transition-colors ${
                              annotation.type === "highlight"
                                ? "bg-yellow-200 bg-opacity-30 border-red-400 hover:bg-yellow-300 hover:bg-opacity-40"
                                : "bg-blue-200 bg-opacity-30 border-red-400 hover:bg-blue-300 hover:bg-opacity-40"
                            } ${selectedAnnotation?.id === annotation.id ? "ring-2 ring-blue-500" : ""}`}
                            style={{
                              left: `${(highlightX / currentViewport.width) * 100}%`,
                              top: `${(highlightY / currentViewport.height) * 100}%`,
                              width: `${(highlightWidth / currentViewport.width) * 100}%`,
                              height: `${(highlightHeight / currentViewport.height) * 100}%`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedAnnotation(annotation)
                              // 自动滚动到对应的批注项
                              scrollToAnnotationItem(annotation.id)
                            }}
                            title={annotation.aiAnnotation?.originalData.title || annotation.content}
                          />
                        )
                      } else {
                        // 回退到原有的计算方法（用于手动添加的注释）
                        // 但如果有coordinates，优先使用统一计算方法
                        const canvas = pageRefs.current.get(pageNumber)
                        if (!canvas) return null

                        let style
                        if (annotation.coordinates) {
                          // 使用统一的坐标计算
                          style = calculateDisplayPosition(annotation.coordinates, canvas)
                        } else {
                          // 使用旧方法作为最后的fallback
                          const x = annotation.x ?? 0
                          const y = annotation.y ?? 0
                          const width = annotation.width ?? 100
                          const height = annotation.height ?? 20
                          style = {
                            left: `${(x / (canvas.width || 1)) * 100}%`,
                            top: `${(y / (canvas.height || 1)) * 100}%`,
                            width: `${(width / (canvas.width || 1)) * 100}%`,
                            height: `${(height / (canvas.height || 1)) * 100}%`,
                          }
                        }

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
                              // 自动滚动到对应的批注项
                              scrollToAnnotationItem(annotation.id)
                            }}
                            title={annotation.aiAnnotation?.originalData.title || annotation.content}
                          />
                        )
                      }
                    })}

                  {/* 渲染搜索高亮 - 修正高亮框位置计算 */}
                  {searchResults
                    .filter((result) => result.pageIndex === index)
                    .map((result, resultIndex) => {
                      const isCurrentResult = searchResults.indexOf(result) === currentSearchIndex
                      const canvas = pageRefs.current.get(pageNumber)

                      if (!canvas) return null

                      // 获取当前页面的视口信息
                      const currentViewport = { width: canvas.width, height: canvas.height }

                      // 计算高亮框在当前缩放级别下的位置
                      // 使用原始坐标系统中的位置，然后转换到当前缩放级别
                      const scaleRatio = scale / 1 // 从scale=1转换到当前scale
                      const highlightX = result.coordinates.viewportCoordinates.x * scaleRatio
                      const highlightY = result.coordinates.viewportCoordinates.y * scaleRatio
                      const highlightWidth = result.coordinates.viewportCoordinates.width * scaleRatio
                      // 增加标注框的高度，确保完全覆盖文字
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
                          {/* 坐标信息显示 */}
                          <div className="absolute -top-12 left-0 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                            <div className="flex gap-3">
                              <span className="text-green-300">
                                PDF: ({result.coordinates.pdfCoordinates.x.toFixed(1)},{" "}
                                {result.coordinates.pdfCoordinates.y.toFixed(1)})
                              </span>
                              <span className="text-blue-300">
                                视口: ({result.coordinates.viewportCoordinates.x.toFixed(1)},{" "}
                                {result.coordinates.viewportCoordinates.y.toFixed(1)})
                              </span>
                            </div>
                            <div className="text-gray-300 text-xs mt-1">
                              第{result.pageIndex + 1}页 第{result.paragraphIndex}段
                            </div>
                          </div>

                          {/* 当前选中结果的额外标识 */}
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
      </div>

      {/* 拖拽手柄 */}
      <div
        className={`w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors relative ${
          isResizing ? "bg-blue-500" : ""
        }`}
        onMouseDown={handleMouseDown}
        style={{
          position: "fixed",
          right: `${panelWidth}px`,
          top: 0,
          bottom: 0,
          zIndex: 10,
        }}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* 侧边栏 - 移到右侧，使用固定定位 */}
      <div
        className="bg-white border-l border-gray-200 flex flex-col fixed right-0 top-0 bottom-0"
        style={{ width: `${panelWidth}px` }}
      >
        {/* 可选：显示面板信息的标题栏 */}
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <span>Panel Width: {panelWidth}px</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          </div>
        </div>
        {/* 标签页内容 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 m-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              搜索
            </TabsTrigger>
            <TabsTrigger value="annotations" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              批注 ({annotations.length})
            </TabsTrigger>
          </TabsList>
          
          {/* 搜索标签页 */}
          <TabsContent value="search" className="flex-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Search
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search in PDF..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        searchText()
                      }
                    }}
                  />
                  <Button onClick={() => searchText()} size="sm">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">{searchResults.length} results found</div>
                      <Button size="sm" variant="outline" onClick={() => setShowCoordinates(!showCoordinates)}>
                        <MapPin className="w-3 h-3 mr-1" />
                        {showCoordinates ? "Hide" : "Show"} Coords
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => goToSearchResult(currentSearchIndex - 1)}
                        disabled={currentSearchIndex <= 0}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => goToSearchResult(currentSearchIndex + 1)}
                        disabled={currentSearchIndex >= searchResults.length - 1}
                      >
                        Next
                      </Button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {searchResults.map((result, index) => (
                        <div
                          key={index}
                          className={`p-3 text-sm border rounded cursor-pointer transition-colors ${
                            index === currentSearchIndex ? "bg-blue-100 border-blue-300" : "hover:bg-gray-50"
                          }`}
                          onClick={() => goToSearchResult(index)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-medium text-blue-600">
                              第 {result.pageIndex + 1} 页 第 {result.paragraphIndex} 段
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {index + 1}/{searchResults.length}
                            </Badge>
                          </div>
                          <div className="text-gray-800 font-medium mb-1">"{result.text}"</div>
                          <div className="text-gray-500 text-xs leading-relaxed mb-2">上下文: {result.context}</div>

                          {showCoordinates && (
                            <div className="bg-gray-50 p-2 rounded text-xs space-y-1 border-t">
                              <div className="font-medium text-gray-700">坐标信息:</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <div className="font-medium text-blue-600">PDF坐标:</div>
                                  <div>X: {result.coordinates.pdfCoordinates.x.toFixed(2)}</div>
                                  <div>Y: {result.coordinates.pdfCoordinates.y.toFixed(2)}</div>
                                </div>
                                <div>
                                  <div className="font-medium text-green-600">视口坐标:</div>
                                  <div>X: {result.coordinates.viewportCoordinates.x.toFixed(2)}</div>
                                  <div>Y: {result.coordinates.viewportCoordinates.y.toFixed(2)}</div>
                                </div>
                              </div>
                              <div>
                                <div className="font-medium text-purple-600">相对位置:</div>
                                <div>X: {result.coordinates.relativePosition.xPercent}%</div>
                                <div>Y: {result.coordinates.relativePosition.yPercent}%</div>
                              </div>
                              <div>
                                <div className="font-medium text-orange-600">尺寸:</div>
                                <div>W: {result.coordinates.pdfCoordinates.width.toFixed(2)}</div>
                                <div>H: {result.coordinates.pdfCoordinates.height.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="font-medium text-red-600">变换矩阵:</div>
                                <div className="text-xs font-mono">
                                  [{result.coordinates.transform.map((t: number) => t.toFixed(1)).join(", ")}]
                                </div>
                              </div>
                              <div>
                                <div className="font-medium text-indigo-600">页面尺寸:</div>
                                <div>
                                  {result.coordinates.pageSize.width.toFixed(0)} ×{" "}
                                  {result.coordinates.pageSize.height.toFixed(0)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 调试信息面板 */}
            {showDebugPanel && debugInfo.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4" />
                    文本定位调试信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-64 overflow-y-auto">
                  {debugInfo.map((info, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg text-xs ${
                        info.found
                          ? "bg-green-50 border-green-200"
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-gray-800">
                          {info.found ? "✅ 找到" : "❌ 未找到"}
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            AI建议: 页面 {info.page}
                          </Badge>
                          {info.found && info.actualPage && info.actualPage !== info.page && (
                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                              实际: 页面 {info.actualPage}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {info.searchStrategy && (
                        <div className="mb-2 p-2 bg-blue-50 rounded text-xs">
                          <div className="font-medium text-blue-700 mb-1">搜索策略:</div>
                          <div className="text-blue-600">{info.searchStrategy}</div>
                        </div>
                      )}
                      
                      <div className="mb-2">
                        <div className="font-medium text-gray-600 mb-1">查找文本:</div>
                        <div className="bg-white p-2 rounded border text-gray-800">
                          "{info.text}"
                        </div>
                      </div>

                      {info.found && info.coordinates ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="font-medium text-blue-600">视口坐标:</div>
                              <div>X: {info.coordinates.viewport.x}</div>
                              <div>Y: {info.coordinates.viewport.y}</div>
                            </div>
                            <div>
                              <div className="font-medium text-green-600">PDF坐标:</div>
                              <div>X: {info.coordinates.pdf.x}</div>
                              <div>Y: {info.coordinates.pdf.y}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="font-medium text-purple-600">尺寸:</div>
                              <div>W: {info.coordinates.size.w}</div>
                              <div>H: {info.coordinates.size.h}</div>
                            </div>
                            <div>
                              <div className="font-medium text-orange-600">页面尺寸:</div>
                              <div>{info.coordinates.pageSize.w} × {info.coordinates.pageSize.h}</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        info.fallbackCoordinates && (
                          <div>
                            <div className="font-medium text-red-600">默认位置:</div>
                            <div>X: {info.fallbackCoordinates.x}, Y: {info.fallbackCoordinates.y}</div>
                          </div>
                        )
                      )}
                    </div>
                  ))}
                  
                  <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
                    <div className="font-medium text-gray-700">统计信息:</div>
                    <div>总计: {debugInfo.length} 个批注</div>
                    <div>成功定位: {debugInfo.filter(info => info.found).length} 个</div>
                    <div>使用默认位置: {debugInfo.filter(info => !info.found).length} 个</div>
                    <div className="mt-2 border-t pt-2">
                      <div className="font-medium text-blue-700">搜索详情:</div>
                      <div>指定页面直接找到: {debugInfo.filter(info => info.found && info.actualPage === info.page).length} 个</div>
                      <div>全页面搜索找到: {debugInfo.filter(info => info.found && info.actualPage !== info.page).length} 个</div>
                      <div>完全未找到: {debugInfo.filter(info => !info.found).length} 个</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 批注标签页 */}
          <TabsContent value="annotations" className="flex-1 flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Annotations ({annotations.length})
                </CardTitle>
                {annotations.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <span>📖</span>
                    <span>已按PDF内容顺序排列</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-1 flex-1 flex flex-col space-y-2">
                <div ref={annotationPanelRef} className="space-y-1 flex-1 overflow-y-auto max-h-[calc(100vh-250px)]">
                  {sortAnnotations(annotations).map((annotation) => (
                    <AnnotationBubble
                      key={annotation.id}
                      className={selectedAnnotation?.id === annotation.id ? "bg-blue-50 border-blue-300" : ""}
                      onClick={(e) => {
                        // 如果点击的是回复区域，不处理折叠/展开
                        if ((e.target as HTMLElement).closest('.annotation-replies-area')) {
                          return;
                        }
                        
                        // 修改展开/折叠逻辑，确保不影响布局
                        setAnnotations((prev) =>
                          prev.map((a) =>
                            a.id === annotation.id
                              ? { ...a, isExpanded: !a.isExpanded }
                              : a
                          )
                        )
                        // 设置选中的批注
                        setSelectedAnnotation(annotation)
                        // 滚动到PDF中对应的位置
                        const pageElement = document.getElementById(`page-${annotation.pageIndex + 1}`)
                        if (pageElement) {
                          pageElement.scrollIntoView({ behavior: "smooth", block: "center" })
                        }
                      }}
                    >
                      <div className="flex w-full gap-2">
                        <div 
                          ref={(el) => {
                            if (el) {
                              annotationItemRefs.current.set(annotation.id, el)
                            } else {
                              annotationItemRefs.current.delete(annotation.id)
                            }
                          }}
                          className="flex-shrink-0" // 添加这个类防止图标被挤压
                        >
                          <AnnotationIcon 
                            role={annotation.author.role} 
                            type={annotation.type}
                          />
                        </div>
                        <AnnotationContent className="w-full"> {/* 添加宽度控制 */}
                          <AnnotationHeader>
                            <AnnotationAuthorName role={annotation.author.role} />
                            <span className="text-gray-400">•</span>
                            <span>{formatTimestamp(annotation.timestamp)}</span>
                            <span className="text-gray-400">•</span>
                            <span>第{annotation.pageIndex + 1}页</span>
                            <div className="ml-auto">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAnnotations((prev) => prev.filter((a) => a.id !== annotation.id))
                                }}
                                className="text-red-500 hover:text-red-700 h-5 w-5 p-0"
                              >
                                ×
                              </Button>
                            </div>
                          </AnnotationHeader>
                          {annotation.aiAnnotation ? (
                            <>
                              {annotation.aiAnnotation.selectedText && (
                                <QuotedText text={annotation.aiAnnotation.selectedText} />
                              )}
                              {annotation.isEditing ? (
                                <div className="mt-2">
                                  <Textarea
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    className="w-full min-h-[100px] text-sm"
                                  />
                                  <div className="flex justify-end gap-2 mt-2">
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={() => toggleAnnotationEditMode(annotation)}
                                    >
                                      取消
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      onClick={() => handleEditAnnotation(annotation, editingContent)}
                                    >
                                      保存
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <AnnotationBody 
                                  isExpanded={annotation.isExpanded || false}
                                  maxLines={3}
                                  onClick={() => toggleAnnotationEditMode(annotation)}
                                  className="cursor-pointer hover:bg-gray-50"
                                >
                                  {annotation.aiAnnotation.mergedContent}
                                </AnnotationBody>
                              )}
                            </>
                          ) : (
                            annotation.isEditing ? (
                              <div className="mt-2">
                                <Textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="w-full min-h-[100px] text-sm"
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => toggleAnnotationEditMode(annotation)}
                                  >
                                    取消
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleEditAnnotation(annotation, editingContent)}
                                  >
                                    保存
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <AnnotationBody 
                                isExpanded={annotation.isExpanded || false}
                                maxLines={3}
                                onClick={() => toggleAnnotationEditMode(annotation)}
                                className="cursor-pointer hover:bg-gray-50"
                              >
                                {annotation.content}
                              </AnnotationBody>
                            )
                          )}
                        </AnnotationContent>
                      </div>
                      
                      {annotation.isExpanded && (
                        <div className="pl-8 pb-2 w-full mt-2 annotation-replies-area">
                          {/* 回复列表 */}
                          {annotation.replies && annotation.replies.length > 0 && (
                            <div className="space-y-2 mb-2">
                              {annotation.replies.map(reply => (
                                <div key={reply.id} className="flex items-start gap-2">
                                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs flex-shrink-0">{reply.author.avatar || "💬"}</span>
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                                      <span>{reply.author.name}</span>
                                      <span className="text-gray-400">•</span>
                                      <span>{formatTimestamp(reply.timestamp)}</span>
                                    </div>
                                    {reply.isEditing ? (
                                      <div className="mt-1">
                                        <Textarea
                                          value={editingContent}
                                          onChange={(e) => setEditingContent(e.target.value)}
                                          className="w-full min-h-[60px] text-sm"
                                        />
                                        <div className="flex justify-end gap-2 mt-1">
                                          <Button 
                                            size="sm" 
                                            variant="outline" 
                                            onClick={() => toggleReplyEditMode(annotation.id, reply)}
                                            className="h-7 text-xs"
                                          >
                                            取消
                                          </Button>
                                          <Button 
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => handleEditReply(annotation.id, reply.id, editingContent)}
                                          >
                                            保存
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div 
                                        className="text-sm text-gray-700 whitespace-pre-line break-words cursor-pointer hover:bg-gray-50 p-1 rounded"
                                        onClick={() => toggleReplyEditMode(annotation.id, reply)}
                                      >
                                        {reply.content}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* 添加回复输入框 */}
                          <form onSubmit={e => {
                            e.preventDefault();
                            const form = e.target as HTMLFormElement;
                            const input = form.reply as HTMLInputElement;
                            const value = input.value.trim();
                            if (!value) return;
                            setAnnotations(prev => prev.map(a =>
                              a.id === annotation.id
                                ? {
                                    ...a,
                                    replies: [
                                      ...(a.replies || []),
                                      {
                                        id: Date.now().toString(),
                                        author: addDefaultAuthorInfo("手动批注者"),
                                        content: value,
                                        timestamp: getCurrentTimestamp(),
                                      }
                                    ]
                                  }
                                : a
                            ));
                            input.value = "";
                          }} className="flex gap-2 items-center mt-2">
                            <input
                              name="reply"
                              type="text"
                              placeholder="添加回复"
                              className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring"
                              autoComplete="off"
                            />
                            <button 
                              type="submit" 
                              className="text-blue-600 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 flex-shrink-0"
                            >回复</button>
                          </form>
                        </div>
                      )}
                    </AnnotationBubble>
                  ))}

                  {annotations.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <div className="text-sm">暂无批注</div>
                      <div className="text-xs">点击"AI自动批注"开始分析</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
