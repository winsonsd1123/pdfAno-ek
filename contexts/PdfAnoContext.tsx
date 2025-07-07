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
import { addDefaultAuthorInfo, getCurrentTimestamp } from "@/lib/annotation-utils"

// 定义Context的状态接口
interface PdfAnoContextState {
  pdfDoc: PDFDocumentProxy | null
  numPages: number
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
  zoomIn: () => void
  zoomOut: () => void
  searchText: (options?: { query?: string; targetPage?: number; returnFirst?: boolean }) => Promise<any>
  goToSearchResult: (index: number) => void
  performAutoAnnotation: () => Promise<void>
  handleEditAnnotation: (annotation: Annotation, newContent: string) => void
  handleEditReply: (annotationId: string, replyId: string, newContent: string) => void
  toggleAnnotationEditMode: (annotation: Annotation) => void
  toggleReplyEditMode: (annotationId: string, reply: AnnotationReply) => void
  sortAnnotations: (annotations: Annotation[]) => Annotation[]
  scrollToAnnotationItem: (annotationId: string) => void
  setDebugInfo: React.Dispatch<React.SetStateAction<DebugInfo[]>>
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
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
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
    setAnnotations(prev => prev.map(a => 
      a.id === annotation.id ? {
        ...a, 
        isEditing: false,
        content: newContent,
        aiAnnotation: a.aiAnnotation ? { ...a.aiAnnotation, mergedContent: newContent } : undefined
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


  const value: PdfAnoContextType = {
    // State
    pdfDoc,
    numPages,
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
    zoomIn,
    zoomOut,
    searchText,
    goToSearchResult,
    performAutoAnnotation,
    handleEditAnnotation,
    handleEditReply,
    toggleAnnotationEditMode,
    toggleReplyEditMode,
    sortAnnotations,
    scrollToAnnotationItem,
    setDebugInfo,
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