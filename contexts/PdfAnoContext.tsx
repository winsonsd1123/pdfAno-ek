"use client"

import type React from "react"
import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useRef, 
  useCallback, 
  ReactNode 
} from "react"
import type { 
  Annotation, 
  AnnotationReply, 
  DebugInfo, 
  PDFDocumentProxy, 
  SearchResult 
} from "@/types/pdf-annotation"

// 导入PDF工具模块
import { loadPDFDocument } from "@/lib/pdf-loader"
import { createPDFRenderer, ScaleController, type PDFRenderer } from "@/lib/pdf-renderer"
import { createTextExtractor, type PDFTextExtractor } from "@/lib/pdf-text-extractor"
import { createAIAnnotationService, type AIAnnotationService } from "@/lib/ai-annotation-service"
import { createAnnotationRoles, addDefaultAuthorInfo, getCurrentTimestamp } from "@/lib/annotation-utils"
import { useAuth } from "@/contexts/AuthContext"

// 定义Context的状态接口
interface PdfAnoContextState {
  pdfDoc: PDFDocumentProxy | null
  numPages: number
  currentPage: number  // 新增：当前页码
  scale: number
  annotations: Annotation[]
  selectedAnnotation: Annotation | null
  searchResults: SearchResult[]
  currentSearchIndex: number
  loading: boolean
  error: string | null
  isAutoAnnotating: boolean
  autoAnnotationProgress: string
  debugInfo: DebugInfo[]
  editingContent: string
  panelWidth: number
  isManualAnnotationMode: boolean // 新增：手动批注模式状态
  docUrl: string // 新增：文档URL，用于导出等操作
  // Refs exposed for specific components
  containerRef: React.RefObject<HTMLDivElement | null>
  pageRefs: React.RefObject<Map<number, HTMLCanvasElement>>
  annotationPanelRef: React.RefObject<HTMLDivElement | null>
  annotationItemRefs: React.RefObject<Map<string, HTMLDivElement>>
  pdfRenderer: React.RefObject<PDFRenderer | null>
}

// 定义Context的操作接口
interface PdfAnoContextActions {
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>
  setSelectedAnnotation: React.Dispatch<React.SetStateAction<Annotation | null>>
  setEditingContent: React.Dispatch<React.SetStateAction<string>>
  setPanelWidth: React.Dispatch<React.SetStateAction<number>>
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>  // 新增：设置当前页码
  zoomIn: () => void
  zoomOut: () => void
  searchText: (options?: { query?: string; targetPage?: number; returnFirst?: boolean }) => Promise<any>
  goToSearchResult: (index: number) => void
  performAutoAnnotation: () => Promise<void>
  toggleManualAnnotationMode: () => void // 新增：切换手动模式
  addManualAnnotation: (pageIndex: number, rect: { x: number; y: number; width: number; height: number }) => Promise<void>
  extractTextFromRect: (pageIndex: number, rect: { x: number; y: number; width: number; height: number }) => Promise<string>
  handleEditAnnotation: (annotation: Annotation, newContent: string) => void
  handleEditReply: (annotationId: string, replyId: string, newContent: string) => void
  toggleAnnotationEditMode: (annotation: Annotation) => void
  toggleReplyEditMode: (annotationId: string, reply: AnnotationReply) => void
  sortAnnotations: (annotations: Annotation[]) => Annotation[]
  scrollToAnnotationItem: (annotationId: string) => void
  setDebugInfo: React.Dispatch<React.SetStateAction<DebugInfo[]>>
  deleteAnnotation: (annotationId: string) => void // 新增：删除批注功能
}

// 合并状态和操作
type PdfAnoContextType = PdfAnoContextState & PdfAnoContextActions

// 创建Context
const PdfAnoContext = createContext<PdfAnoContextType | null>(null)

// 创建Provider Props接口
interface PdfAnoProviderProps {
  children: ReactNode
  docUrl: string
}

// 创建Provider组件
export function PdfAnoProvider({ children, docUrl }: PdfAnoProviderProps) {
  const { profile } = useAuth()
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)  // 新增：当前页码状态
  const [scale, setScale] = useState(1.5)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAutoAnnotating, setIsAutoAnnotating] = useState(false)
  const [autoAnnotationProgress, setAutoAnnotationProgress] = useState("")
  const [debugInfo, setDebugInfo] = useState<DebugInfo[]>([])
  const [editingContent, setEditingContent] = useState("")
  const [panelWidth, setPanelWidth] = useState(450)
  const [isManualAnnotationMode, setIsManualAnnotationMode] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const annotationPanelRef = useRef<HTMLDivElement | null>(null)
  const annotationItemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const pdfRenderer = useRef<PDFRenderer | null>(null)
  const textExtractor = useRef<PDFTextExtractor | null>(null)
  const aiAnnotationService = useRef<AIAnnotationService | null>(null)
  const scaleController = useRef(new ScaleController(1.5, 0.5, 3.0, 0.25))

  const sortAnnotations = useCallback((annotations: Annotation[]): Annotation[] => {
    return [...annotations].sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
      if (a.coordinates && b.coordinates) {
        return b.coordinates.pdfCoordinates.y - a.coordinates.pdfCoordinates.y
      }
      const aY = a.coordinates?.viewportCoordinates.y ?? a.y ?? 0
      const bY = b.coordinates?.viewportCoordinates.y ?? b.y ?? 0
      return aY - bY
    })
  }, [])

  const scrollToAnnotationItem = useCallback((annotationId: string) => {
    const annotationElement = annotationItemRefs.current.get(annotationId)
    const panelElement = annotationPanelRef.current
    if (annotationElement && panelElement) {
      annotationElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      annotationElement.classList.add('animate-pulse')
      setTimeout(() => annotationElement.classList.remove('animate-pulse'), 1000)
    }
  }, [])
  
  const searchText = useCallback(async (options?: {
    query?: string;
    targetPage?: number;
    returnFirst?: boolean;
  }) => {
    const queryText = options?.query
    const targetPage = options?.targetPage
    const returnFirst = options?.returnFirst || false

    if (!textExtractor.current || !queryText?.trim()) {
      if (!returnFirst) setSearchResults([])
      return returnFirst ? null : undefined
    }

    try {
      const results = await textExtractor.current.searchText({ query: queryText, targetPage, returnFirst })
      if (returnFirst) {
        return results as any
      } else {
        const resultArray = Array.isArray(results) ? results : (results ? [results] : [])
        setSearchResults(resultArray)
        setCurrentSearchIndex(resultArray.length > 0 ? 0 : -1)
        return undefined
      }
    } catch (err) {
      console.error("Search failed:", err)
      return returnFirst ? null : undefined
    }
  }, [textExtractor])

  // 初始化PDF.js和文档加载
  useEffect(() => {
    const loadAndInit = async () => {
      try {
        setLoading(true)
        setError(null)
        const pdf = await loadPDFDocument(docUrl)
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)

        pdfRenderer.current = createPDFRenderer(pdf, scale)
        textExtractor.current = createTextExtractor(pdf)
        
        // 这部分逻辑将移动到 PdfViewer 组件中
        // if (containerRef.current && pdfRenderer.current) {
        //   pdfRenderer.current.setContainer(containerRef.current)
        //   pdfRenderer.current.setupLazyLoading()
        // }
        
        setLoading(false)
      } catch (err: any) {
        console.error("PDF load failed:", err)
        setError(err.message || "Failed to load PDF document.")
        setLoading(false)
      }
    }
    if(docUrl) loadAndInit()
  }, [docUrl, scale]) // 移除searchText, 保留scale因为renderer依赖它

  // 独立初始化AI服务，确保它在核心工具准备好之后再进行
  useEffect(() => {
    if (pdfDoc && textExtractor.current) {
        aiAnnotationService.current = createAIAnnotationService({ onDebugInfo: setDebugInfo })
        aiAnnotationService.current.initialize(pdfDoc, textExtractor.current, searchText)
    }
  }, [pdfDoc, textExtractor, searchText, setDebugInfo])

  // 缩放控制和更新
  useEffect(() => {
    if (pdfRenderer.current) {
      pdfRenderer.current.updateScale(scale)
      scaleController.current.setScale(scale)
    }
  }, [scale])

  const zoomIn = () => setScale(scaleController.current.zoomIn())
  const zoomOut = () => setScale(scaleController.current.zoomOut())

  const toggleManualAnnotationMode = useCallback(() => {
    setIsManualAnnotationMode(prev => !prev)
  }, [])

  const extractTextFromRect = useCallback(async (
    pageIndex: number, 
    rect: { x: number; y: number; width: number; height: number }
  ): Promise<string> => {
    if (!pdfDoc) return ""

    try {
      const page = await pdfDoc.getPage(pageIndex + 1)
      const textContent = await page.getTextContent()
      const viewport = page.getViewport({ scale: 1 })
      
      const textItems = textContent.items as any[]
      const overlappingItems: { item: any; y: number; x: number }[] = []

      // 遍历所有文本项，找出与矩形重叠的项
      textItems.forEach((item) => {
        if (!item.transform) return

        const itemX = item.transform[4]
        const itemY = item.transform[5]
        const itemWidth = item.width || 0
        const itemHeight = item.height || 10 // 默认高度

        // 检查文本项是否与选择矩形重叠
        const itemLeft = itemX
        const itemRight = itemX + itemWidth
        const itemTop = viewport.height - (itemY + itemHeight) // 转换为视口坐标
        const itemBottom = viewport.height - itemY

        const rectLeft = rect.x
        const rectRight = rect.x + rect.width
        const rectTop = rect.y
        const rectBottom = rect.y + rect.height

        // 矩形重叠检测
        const overlaps = !(
          itemRight < rectLeft || 
          itemLeft > rectRight || 
          itemBottom < rectTop || 
          itemTop > rectBottom
        )

        if (overlaps && item.str?.trim()) {
          overlappingItems.push({
            item,
            y: itemTop,
            x: itemLeft
          })
        }
      })

      // 按位置排序：先按Y坐标（从上到下），再按X坐标（从左到右）
      overlappingItems.sort((a, b) => {
        const yDiff = a.y - b.y
        if (Math.abs(yDiff) > 5) return yDiff // Y坐标差距大于5像素认为是不同行
        return a.x - b.x // 同一行内按X坐标排序
      })

      // 拼接文本，保持行的结构
      let result = ""
      let lastY = -1
      
      overlappingItems.forEach(({ item, y }) => {
        if (lastY !== -1 && Math.abs(y - lastY) > 5) {
          result += " " // 不同行之间用空格分隔
        }
        result += item.str
        lastY = y
      })

      return result.trim()
    } catch (err) {
      console.error("Extract text from rect failed:", err)
      return ""
    }
  }, [pdfDoc])

  const addManualAnnotation = useCallback(async (
    pageIndex: number,
    rect: { x: number; y: number; width: number; height: number }
  ): Promise<void> => {
    if (!pdfDoc) return

    try {
      // 提取文本内容
      const extractedText = await extractTextFromRect(pageIndex, rect)
      if (!extractedText.trim()) {
        console.warn("No text found in selected area")
        return
      }

      // 创建坐标信息
      const page = await pdfDoc.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: 1 })
      
      // 将视口坐标转换为PDF坐标
      const pdfRect = {
        x: rect.x,
        y: viewport.height - rect.y - rect.height, // 转换到PDF坐标系（左下角为原点）
        width: rect.width,
        height: rect.height
      }

      const coordinates = {
        pdfCoordinates: pdfRect,
        viewportCoordinates: rect,
        pageSize: {
          width: viewport.width,
          height: viewport.height
        }
      }

      // 创建新的批注对象 - 直接创建用户作者信息，不依赖profile
      const authorInfo = {
        name: profile?.full_name || profile?.username || "匿名用户",
        role: profile?.role?.name || "普通用户", 
        avatar: profile?.avatar_url || "👤",
        color: "green"
      }
      const newAnnotation: Annotation = {
        id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "highlight",
        content: extractedText,
        author: authorInfo,
        pageIndex,
        coordinates,
        timestamp: getCurrentTimestamp(),
        isEditing: true,
        isExpanded: true,
        // 添加 aiAnnotation 结构，使其显示效果与 AI 批注一致
        aiAnnotation: {
          selectedText: extractedText,
          mergedContent: "",
          originalData: {
            title: "手动批注",
            description: "",
            suggestion: "等待用户输入批注内容",
            annotationType: "manual",
            severity: "medium"
          }
        }
      }

      // 添加到批注列表并设置为选中状态
      setAnnotations(prev => [...prev, newAnnotation])
      setSelectedAnnotation(newAnnotation)
      setEditingContent("")
    } catch (err) {
      console.error("Add manual annotation failed:", err)
    }
  }, [pdfDoc, extractTextFromRect, profile])

  const goToSearchResult = useCallback((index: number) => {
    if (index < 0 || index >= searchResults.length) return
    const result = searchResults[index]
    const pageElement = document.getElementById(`page-${result.pageIndex + 1}`)
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: "smooth", block: "center" })
      setCurrentSearchIndex(index)
    }
  }, [searchResults])

  const performAutoAnnotation = useCallback(async () => {
    if (!aiAnnotationService.current || isAutoAnnotating) return
    setIsAutoAnnotating(true)
    setAutoAnnotationProgress("启动AI批注...")
    setDebugInfo([])
    try {
      const result = await aiAnnotationService.current.performAutoAnnotation()
      setAnnotations(prev => [...prev, ...result])
      setAutoAnnotationProgress(`完成! 生成 ${result.length} 条批注.`)
      setTimeout(() => setAutoAnnotationProgress(""), 5000)
    } catch (err: any) {
      console.error("Auto annotation error:", err)
      setAutoAnnotationProgress(`批注失败: ${err.message}`)
      setTimeout(() => setAutoAnnotationProgress(""), 8000)
    } finally {
      setIsAutoAnnotating(false)
    }
  }, [isAutoAnnotating])

  const handleEditAnnotation = useCallback((annotation: Annotation, newContent: string) => {
    // 如果是手动批注且内容为空，不允许保存
    if (annotation.aiAnnotation?.originalData.annotationType === "manual" && !newContent.trim()) {
      console.warn("手动批注内容不能为空")
      return
    }

    setAnnotations(prev => prev.map(a => 
      a.id === annotation.id ? {
        ...a, 
        isEditing: false,
        content: newContent,
        aiAnnotation: a.aiAnnotation ? { 
          ...a.aiAnnotation, 
          mergedContent: newContent,
          originalData: {
            ...a.aiAnnotation.originalData,
            description: newContent // 更新description为用户输入的内容
          }
        } : undefined
      } : a
    ))
  }, [])

  const handleEditReply = useCallback((annotationId: string, replyId: string, newContent: string) => {
    setAnnotations(prev => prev.map(a => 
      a.id === annotationId ? {
        ...a,
        replies: a.replies?.map(r => 
          r.id === replyId ? { ...r, isEditing: false, content: newContent } : r
        )
      } : a
    ))
  }, [])

  const toggleAnnotationEditMode = useCallback((annotation: Annotation) => {
    // 如果是手动批注，且正在编辑，且内容为空，则删除该批注
    if (
      annotation.isEditing && 
      annotation.aiAnnotation?.originalData.annotationType === "manual" &&
      !annotation.aiAnnotation.mergedContent.trim()
    ) {
      setAnnotations(prev => prev.filter(a => a.id !== annotation.id))
      setSelectedAnnotation(null)
      return
    }

    setEditingContent(annotation.aiAnnotation?.mergedContent || annotation.content)
    setAnnotations(prev => prev.map(a => 
      a.id === annotation.id ? { ...a, isEditing: !a.isEditing } : { ...a, isEditing: false }
    ))
  }, [])

  const toggleReplyEditMode = useCallback((annotationId: string, reply: AnnotationReply) => {
    setEditingContent(reply.content)
    setAnnotations(prev => prev.map(a => 
      a.id === annotationId ? {
        ...a,
        replies: a.replies?.map(r => 
          r.id === reply.id ? { ...r, isEditing: !r.isEditing } : { ...r, isEditing: false }
        )
      } : a
    ))
  }, [])

  // 添加删除批注的函数
  const deleteAnnotation = useCallback((annotationId: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== annotationId))
    setSelectedAnnotation(null)
  }, [])

  const value: PdfAnoContextType = {
    // State
    pdfDoc,
    numPages,
    currentPage,
    scale,
    annotations,
    selectedAnnotation,
    searchResults,
    currentSearchIndex,
    loading,
    error,
    isAutoAnnotating,
    autoAnnotationProgress,
    debugInfo,
    editingContent,
    panelWidth,
    isManualAnnotationMode,
    docUrl, // 新增：将docUrl暴露给Context消费者
    // Refs
    containerRef,
    pageRefs,
    annotationPanelRef,
    annotationItemRefs,
    pdfRenderer,
    // Actions
    setAnnotations,
    setSelectedAnnotation,
    setEditingContent,
    setPanelWidth,
    setCurrentPage,  // 新增：暴露 setCurrentPage 方法
    zoomIn,
    zoomOut,
    searchText,
    goToSearchResult,
    performAutoAnnotation,
    toggleManualAnnotationMode,
    addManualAnnotation,
    extractTextFromRect,
    handleEditAnnotation,
    handleEditReply,
    toggleAnnotationEditMode,
    toggleReplyEditMode,
    sortAnnotations,
    scrollToAnnotationItem,
    setDebugInfo,
    deleteAnnotation, // 添加删除功能到Context
  }

  return <PdfAnoContext.Provider value={value}>{children}</PdfAnoContext.Provider>
}

// 创建自定义Hook
export function usePdfAnoContext() {
  const context = useContext(PdfAnoContext)
  if (!context) {
    throw new Error("usePdfAnoContext必须在PdfAnoProvider内部使用")
  }
  return context
}
