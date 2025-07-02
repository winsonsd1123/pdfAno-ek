"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, MessageSquare, ZoomIn, ZoomOut, MapPin } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

// PDF.js types
interface PDFDocumentProxy {
  numPages: number
  getPage: (pageNumber: number) => Promise<PDFPageProxy>
  getDestinations: () => Promise<any>
  cleanup: () => void
}

interface PDFPageProxy {
  getViewport: (options: { scale: number; rotation?: number }) => PDFPageViewport
  render: (renderContext: any) => PDFRenderTask
  getTextContent: () => Promise<TextContent>
  getAnnotations: () => Promise<any[]>
  cleanup: () => void
}

interface PDFPageViewport {
  width: number
  height: number
  transform: number[]
  clone: (options?: { scale?: number; rotation?: number }) => PDFPageViewport
}

interface PDFRenderTask {
  promise: Promise<void>
  cancel: () => void
}

interface TextContent {
  items: TextItem[]
}

interface TextItem {
  str: string
  dir: string
  width: number
  height: number
  transform: number[]
  fontName: string
}

interface SearchResult {
  pageIndex: number
  textIndex: number
  paragraphIndex: number
  text: string
  x: number
  y: number
  width: number
  height: number
  context: string
  // 添加详细的坐标信息
  coordinates: {
    // PDF原始坐标系统
    pdfCoordinates: {
      x: number
      y: number
      width: number
      height: number
    }
    // 视口坐标系统
    viewportCoordinates: {
      x: number
      y: number
      width: number
      height: number
    }
    // 变换矩阵
    transform: number[]
    // 页面尺寸信息
    pageSize: {
      width: number
      height: number
    }
    // 相对位置百分比
    relativePosition: {
      xPercent: number
      yPercent: number
    }
  }
}

interface Annotation {
  id: string
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  content: string
  type: "highlight" | "note"
  // 添加AI批注的详细信息
  aiAnnotation?: {
    selectedText: string
    title: string
    description: string
    suggestion: string
    annotationType: string
    severity: string
  }
  // 添加坐标信息，与搜索结果保持一致
  coordinates?: {
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
}

const PDF_URL =
  "https://xpzbccdjc5ty6al1.public.blob.vercel-storage.com/advertisement-computing-rrttEVTmdSQcWy9D17QnNq77h49KFV.pdf"

export default function PDFViewer() {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.5)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false)
  const [newAnnotationContent, setNewAnnotationContent] = useState("")
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
  const [panelWidth, setPanelWidth] = useState(320) // 默认320px宽度
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

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const renderedPages = useRef<Set<number>>(new Set())

  // Add render task tracking
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
      // 优先使用PDF.js的坐标信息
      if (a.coordinates && b.coordinates) {
        // 使用PDF坐标系统的Y坐标进行排序（PDF坐标系是从下往上的，所以较大的Y值在上方）
        return b.coordinates.pdfCoordinates.y - a.coordinates.pdfCoordinates.y
      }
      
      // 回退到视口坐标（视口坐标系是从上往下的，所以较小的Y值在上方）
      if (a.coordinates && !b.coordinates) {
        // 如果只有a有坐标信息，转换为可比较的格式
        return a.coordinates.viewportCoordinates.y - a.y
      }
      
      if (!a.coordinates && b.coordinates) {
        // 如果只有b有坐标信息，转换为可比较的格式
        return a.y - b.coordinates.viewportCoordinates.y
      }
      
      // 都没有详细坐标信息时，使用基础Y坐标（视口坐标系）
      return a.y - b.y
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

  // 渲染PDF页面
  const renderPage = useCallback(
    async (pageNumber: number) => {
      if (!pdfDoc || renderedPages.current.has(pageNumber)) return

      // Cancel any existing render task for this page
      const existingTask = renderTasks.current.get(pageNumber)
      if (existingTask) {
        existingTask.cancel()
        renderTasks.current.delete(pageNumber)
      }

      try {
        const page = await pdfDoc.getPage(pageNumber)
        const viewport = page.getViewport({ scale })

        const canvas = pageRefs.current.get(pageNumber)
        if (!canvas) return

        const context = canvas.getContext("2d")
        if (!context) return

        // Clear the canvas before rendering
        context.clearRect(0, 0, canvas.width, canvas.height)

        canvas.height = viewport.height
        canvas.width = viewport.width

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }

        const renderTask = page.render(renderContext)
        renderTasks.current.set(pageNumber, renderTask)

        await renderTask.promise

        // Mark as rendered and clean up
        renderedPages.current.add(pageNumber)
        renderTasks.current.delete(pageNumber)
      } catch (err: any) {
        // Handle cancellation gracefully
        if (err.name === "RenderingCancelledException") {
          console.log(`Rendering cancelled for page ${pageNumber}`)
        } else {
          console.error(`Error rendering page ${pageNumber}:`, err)
        }
        renderTasks.current.delete(pageNumber)
      }
    },
    [pdfDoc, scale],
  )

  // 加载PDF.js
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        // Load PDF.js 5.3.31 ES module from CDN
        const script = document.createElement("script")
        script.type = "module"
        script.innerHTML = `
          import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.min.mjs';
          
          // Set worker with matching version
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.worker.min.mjs';
          
          // Make pdfjsLib available globally
          window.pdfjsLib = pdfjsLib;
          
          // Dispatch a custom event to signal that PDF.js is loaded
          window.dispatchEvent(new CustomEvent('pdfjsLoaded'));
        `
        
        // Listen for the custom event
        const handlePdfjsLoaded = async () => {
          try {
            const pdfjsLib = (window as any).pdfjsLib

            // Load PDF document
            const loadingTask = pdfjsLib.getDocument({
              url: PDF_URL,
              cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/cmaps/",
              cMapPacked: true,
            })

            const pdf = await loadingTask.promise
            setPdfDoc(pdf)
            setNumPages(pdf.numPages)
            setLoading(false)
          } catch (err) {
            console.error("Error loading PDF document:", err)
            setError("Failed to load PDF document")
            setLoading(false)
          }
        }

        // Add event listener
        window.addEventListener('pdfjsLoaded', handlePdfjsLoaded, { once: true })

        script.onerror = () => {
          console.error("Error loading PDF.js library")
          setError("Failed to load PDF.js library")
          setLoading(false)
        }

        document.head.appendChild(script)

        // Cleanup function
        return () => {
          window.removeEventListener('pdfjsLoaded', handlePdfjsLoaded)
          if (document.head.contains(script)) {
            document.head.removeChild(script)
          }
        }
      } catch (err) {
        console.error("Error setting up PDF.js:", err)
        setError("Failed to initialize PDF viewer")
        setLoading(false)
      }
    }

    loadPdfJs()
  }, [])

  // 设置懒加载观察器
  useEffect(() => {
    if (!pdfDoc) return

    // Disconnect existing observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNumber = Number.parseInt(entry.target.getAttribute("data-page") || "0")
            if (pageNumber && !renderedPages.current.has(pageNumber)) {
              // Add a small delay to prevent rapid successive calls
              setTimeout(() => {
                if (!renderedPages.current.has(pageNumber)) {
                  renderPage(pageNumber)
                }
              }, 50)
            }
          }
        })
      },
      {
        root: containerRef.current,
        rootMargin: "100px",
        threshold: 0.1,
      },
    )

    // Observe existing page elements
    const pageElements = document.querySelectorAll("[data-page]")
    pageElements.forEach((element) => {
      observerRef.current?.observe(element)
    })

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [pdfDoc, renderPage])

  // 搜索文本 - 支持UI搜索和程序化查找
  // 文本标准化函数 - 处理标点符号和空格问题
  const normalizeText = useCallback((text: string): string => {
    return text
      // 统一中文标点符号
      .replace(/[""]/g, '"')  // 统一双引号
      .replace(/['']/g, "'")  // 统一单引号
      .replace(/[，]/g, ',')  // 统一逗号
      .replace(/[。]/g, '.')  // 统一句号
      .replace(/[？]/g, '?')  // 统一问号
      .replace(/[！]/g, '!')  // 统一感叹号
      .replace(/[：]/g, ':')  // 统一冒号
      .replace(/[；]/g, ';')  // 统一分号
      .replace(/[（]/g, '(')  // 统一左括号
      .replace(/[）]/g, ')')  // 统一右括号
      .replace(/[【]/g, '[')  // 统一左方括号
      .replace(/[】]/g, ']')  // 统一右方括号
      // 统一空格和换行
      .replace(/\s+/g, ' ')   // 多个空格合并为一个
      .replace(/[\r\n]+/g, ' ') // 换行符转为空格
      .trim()
  }, [])

  // 智能文本匹配函数
  const smartTextMatch = useCallback((searchText: string, targetText: string): boolean => {
    const normalizedSearch = normalizeText(searchText.toLowerCase())
    const normalizedTarget = normalizeText(targetText.toLowerCase())
    
    // 1. 直接匹配
    if (normalizedTarget.includes(normalizedSearch)) {
      return true
    }
    
    // 2. 移除所有标点符号和空格的匹配
    const cleanSearch = normalizedSearch.replace(/[^\w\u4e00-\u9fff]/g, '')
    const cleanTarget = normalizedTarget.replace(/[^\w\u4e00-\u9fff]/g, '')
    
    if (cleanTarget.includes(cleanSearch)) {
      return true
    }
    
    // 3. 更激进的文本清理：只保留中文字符和字母数字
    const veryCleanSearch = normalizedSearch.replace(/[^\u4e00-\u9fff\w]/g, '')
    const veryCleanTarget = normalizedTarget.replace(/[^\u4e00-\u9fff\w]/g, '')
    
    if (veryCleanTarget.includes(veryCleanSearch)) {
      return true
    }
    
    // 4. 分词匹配：将搜索文本分成关键词进行匹配
    const searchWords = normalizedSearch.split(/\s+/).filter(word => word.length > 0)
    const targetWords = normalizedTarget.split(/\s+/).filter(word => word.length > 0)
    
    if (searchWords.length > 1) {
      // 检查所有关键词是否都能在目标文本中找到
      const foundWords = searchWords.filter(searchWord => {
        return targetWords.some(targetWord => 
          targetWord.includes(searchWord) || 
          targetWord.replace(/[^\w\u4e00-\u9fff]/g, '').includes(searchWord.replace(/[^\w\u4e00-\u9fff]/g, ''))
        )
      })
      
      // 如果找到了80%以上的关键词，认为匹配
      if (foundWords.length >= Math.floor(searchWords.length * 0.8)) {
        return true
      }
    }
    
    // 5. 序列匹配：检查搜索文本的字符序列是否在目标文本中按顺序出现
    if (cleanSearch.length > 3) {
      let searchIndex = 0
      for (let i = 0; i < cleanTarget.length && searchIndex < cleanSearch.length; i++) {
        if (cleanTarget[i] === cleanSearch[searchIndex]) {
          searchIndex++
        }
      }
      
      // 如果找到了85%以上的字符按顺序出现，认为匹配
      if (searchIndex >= Math.floor(cleanSearch.length * 0.85)) {
        return true
      }
    }
    
         // 6. 数字和文本分别匹配（针对"1. 元素优选"这种情况）
     const searchNumbers: string[] = normalizedSearch.match(/\d+/g) || []
     const targetNumbers: string[] = normalizedTarget.match(/\d+/g) || []
     const searchChinese = normalizedSearch.replace(/[^\u4e00-\u9fff]/g, '')
     const targetChinese = normalizedTarget.replace(/[^\u4e00-\u9fff]/g, '')
     
     if (searchNumbers.length > 0 && searchChinese.length > 0) {
       const numbersMatch = searchNumbers.some((num: string) => targetNumbers.includes(num))
       const chineseMatch = targetChinese.includes(searchChinese) || 
                           searchChinese.split('').every((char: string) => targetChinese.includes(char))
       
       if (numbersMatch && chineseMatch) {
         return true
       }
     }
    
    return false
  }, [normalizeText])

  // 创建搜索结果的辅助函数
  const createSearchResult = useCallback((
    item: TextItem,
    pageIndex: number,
    textIndex: number,
    paragraphIndex: number,
    paragraph: TextItem[],
    viewport: PDFPageViewport,
    customText?: string
  ): SearchResult => {
              // 获取变换矩阵信息
              const transform = item.transform

              // PDF原始坐标系统 (左下角为原点)
              const pdfX = transform[4]
              const pdfY = transform[5] // 这是文字基线位置

              // 修正Y坐标计算 - 考虑文字高度，让标注框覆盖整个文字
              // transform[5]是基线位置，需要向上偏移文字高度来获得文字顶部
              const textHeight = item.height
              const pdfYTop = pdfY + textHeight // PDF坐标系中，向上偏移是加法

              // 视口坐标系统 (左上角为原点) - 使用文字顶部位置
              const viewportX = pdfX
              const viewportY = viewport.height - pdfYTop // 转换到视口坐标系

              // 计算相对位置百分比
              const xPercent = (pdfX / viewport.width) * 100
              const yPercent = (viewportY / viewport.height) * 100

              // 获取上下文 - 前后各取一些文本
              const itemPosition = paragraph.indexOf(item)
              const contextStart = Math.max(0, itemPosition - 2)
              const contextEnd = Math.min(paragraph.length, itemPosition + 3)
              const context = paragraph
                .slice(contextStart, contextEnd)
                .map((p) => p.str)
                .join(" ")

    return {
                pageIndex: pageIndex - 1,
                textIndex,
                paragraphIndex: paragraphIndex + 1,
      text: customText || item.str,
                x: viewportX, // 使用视口坐标作为显示坐标
                y: viewportY, // 使用修正后的视口坐标（文字顶部）
                width: item.width,
                height: item.height,
                context: context.length > 100 ? context.substring(0, 100) + "..." : context,
                coordinates: {
                  pdfCoordinates: {
                    x: pdfX,
                    y: pdfY, // 保留原始基线位置用于参考
                    width: item.width,
                    height: item.height,
                  },
                  viewportCoordinates: {
                    x: viewportX,
                    y: viewportY, // 使用文字顶部位置
                    width: item.width,
                    height: item.height,
                  },
                  transform: [...transform],
                  pageSize: {
                    width: viewport.width,
                    height: viewport.height,
                  },
                  relativePosition: {
                    xPercent: Math.round(xPercent * 100) / 100,
                    yPercent: Math.round(yPercent * 100) / 100,
                  },
                },
    }
  }, [])

  const searchText = useCallback(async (options?: {
    query?: string;
    targetPage?: number;
    returnFirst?: boolean;
  }) => {
    const queryText = options?.query || searchQuery
    const targetPage = options?.targetPage
    const returnFirst = options?.returnFirst || false
    
    if (!pdfDoc || !queryText.trim()) {
      if (!returnFirst) {
        setSearchResults([])
      }
      return returnFirst ? null : undefined
    }

    const results: SearchResult[] = []
    const lowerQuery = queryText.toLowerCase()

    try {
      const startPage = targetPage || 1
      const endPage = targetPage || numPages

      for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
        const page = await pdfDoc.getPage(pageIndex)
        const textContent = await page.getTextContent()
        const viewport = page.getViewport({ scale: 1 }) // 使用scale 1获取原始坐标

        // 将文本项按Y坐标分组来识别段落
        const textItems = textContent.items as TextItem[]
        const sortedItems = textItems.sort((a, b) => {
          const aY = viewport.height - a.transform[5]
          const bY = viewport.height - b.transform[5]
          return aY - bY
        })

        // 识别段落 - 基于Y坐标差异
        const paragraphs: TextItem[][] = []
        let currentParagraph: TextItem[] = []
        let lastY = -1

        sortedItems.forEach((item, index) => {
          const currentY = viewport.height - item.transform[5]

          // 如果Y坐标差异超过阈值，认为是新段落
          if (lastY !== -1 && Math.abs(currentY - lastY) > 10) {
            if (currentParagraph.length > 0) {
              paragraphs.push([...currentParagraph])
              currentParagraph = []
            }
          }

          currentParagraph.push(item)
          lastY = currentY

          // 最后一个项目
          if (index === sortedItems.length - 1 && currentParagraph.length > 0) {
            paragraphs.push(currentParagraph)
          }
        })

        // 在每个段落中搜索
        paragraphs.forEach((paragraph, paragraphIndex) => {
          paragraph.forEach((item, textIndex) => {
            // 智能匹配检查（处理标点符号和空格问题）
            if (smartTextMatch(queryText, item.str)) {
              console.log(`✅ 智能单项匹配成功: "${item.str}" 匹配查询 "${queryText}"`)
              const result = createSearchResult(item, pageIndex, textIndex, paragraphIndex, paragraph, viewport)
              results.push(result)
              
              if (returnFirst) {
                return // 注意：这里return只是退出forEach，不是退出函数
              }
            }
            // 传统匹配作为后备
            else if (item.str.toLowerCase().includes(lowerQuery)) {
              const result = createSearchResult(item, pageIndex, textIndex, paragraphIndex, paragraph, viewport)
              results.push(result)
              
              if (returnFirst) {
                return // 注意：这里return只是退出forEach，不是退出函数
              }
            }
          })

          // 段落级别的智能搜索（对于跨TextItem的文本）
          if (returnFirst && results.length === 0) {
            const paragraphText = paragraph.map(item => item.str).join('')
            const paragraphTextWithSpaces = paragraph.map(item => item.str).join(' ')
            
            if (smartTextMatch(queryText, paragraphText) || smartTextMatch(queryText, paragraphTextWithSpaces)) {
              console.log(`✅ 智能段落匹配成功在页面 ${pageIndex} 段落 ${paragraphIndex + 1}`)
              console.log(`   查询: "${queryText}"`)
              console.log(`   匹配: "${paragraphText.substring(0, 100)}${paragraphText.length > 100 ? '...' : ''}"`)
              
              // 使用段落中间的项作为定位点
              const middleIndex = Math.floor(paragraph.length / 2)
              const item = paragraph[middleIndex] || paragraph[0]
              const result = createSearchResult(item, pageIndex, middleIndex, paragraphIndex, paragraph, viewport, queryText)
              results.push(result)
            }
          }
        })

        // 检查是否找到结果并需要立即返回
        if (returnFirst && results.length > 0) {
          const firstResult = results[0]
          return {
            pageIndex: firstResult.pageIndex,
            x: firstResult.x,
            y: firstResult.y,
            width: firstResult.width,
            height: firstResult.height,
            text: firstResult.text,
            pageSize: firstResult.coordinates.pageSize,
          }
        }
      }

      // 如果是UI搜索，更新状态
      if (!returnFirst) {
      setSearchResults(results)
      setCurrentSearchIndex(results.length > 0 ? 0 : -1)
      }

      return returnFirst ? null : undefined
    } catch (err) {
      console.error("Error searching text:", err)
      return returnFirst ? null : undefined
    }
  }, [pdfDoc, searchQuery, numPages, normalizeText, smartTextMatch, createSearchResult])

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

  // 添加注释
  const addAnnotation = useCallback(
    (pageIndex: number, x: number, y: number) => {
      if (!newAnnotationContent.trim()) return

      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        pageIndex,
        x,
        y,
        width: 200,
        height: 100,
        content: newAnnotationContent,
        type: "note",
      }

      setAnnotations((prev) => [...prev, newAnnotation])
      setNewAnnotationContent("")
      setIsAddingAnnotation(false)
    },
    [newAnnotationContent],
  )

  // 处理画布点击事件
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>, pageIndex: number) => {
      if (!isAddingAnnotation) return

      const canvas = event.currentTarget
      const rect = canvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) * (canvas.width / rect.width)
      const y = (event.clientY - rect.top) * (canvas.height / rect.height)

      addAnnotation(pageIndex, x, y)
    },
    [isAddingAnnotation, addAnnotation],
  )

  // 处理鼠标移动事件 - 修正坐标计算逻辑
  const handleMouseMoveCanvas = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>, pageIndex: number) => {
      if (!pdfDoc) return

      const canvas = event.currentTarget
      const rect = canvas.getBoundingClientRect()

      // 计算鼠标在canvas中的相对位置
      const canvasX = event.clientX - rect.left
      const canvasY = event.clientY - rect.top

      // 转换为canvas坐标
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const actualX = canvasX * scaleX
      const actualY = canvasY * scaleY

      try {
        const page = await pdfDoc.getPage(pageIndex + 1)
        const viewport = page.getViewport({ scale: 1 }) // 使用scale=1获取原始坐标
        const currentViewport = page.getViewport({ scale }) // 当前缩放级别的视口

        // 计算在原始坐标系统中的位置
        const normalizedX = (actualX / currentViewport.width) * viewport.width
        const normalizedY = (actualY / currentViewport.height) * viewport.height

        // 视口坐标 (左上角为原点)
        const viewportX = normalizedX
        const viewportY = normalizedY

        // PDF坐标 (左下角为原点)
        const pdfX = normalizedX
        const pdfY = viewport.height - normalizedY

        setMouseCoordinates({
          pageIndex: pageIndex + 1,
          pdfCoords: { x: pdfX, y: pdfY },
          viewportCoords: { x: viewportX, y: viewportY },
          pageSize: { width: viewport.width, height: viewport.height },
        })
      } catch (err) {
        console.error("Error calculating mouse coordinates:", err)
      }
    },
    [pdfDoc, scale],
  )

  // 处理鼠标离开事件
  const handleMouseLeave = useCallback(() => {
    setMouseCoordinates(null)
  }, [])

  // 提取PDF全文内容
  const extractPDFText = useCallback(async () => {
    if (!pdfDoc) return ""

    let fullText = ""

    try {
      for (let pageIndex = 1; pageIndex <= numPages; pageIndex++) {
        const page = await pdfDoc.getPage(pageIndex)
        const textContent = await page.getTextContent()
        const textItems = textContent.items as TextItem[]

        // 按页面添加文本，保持页面分隔
        fullText += `\n--- 第${pageIndex}页 ---\n`

        // 按Y坐标排序文本项
        const sortedItems = textItems.sort((a, b) => {
          const viewport = page.getViewport({ scale: 1 })
          const aY = viewport.height - a.transform[5]
          const bY = viewport.height - b.transform[5]
          return aY - bY
        })

        // 组合文本，保持原有格式
        let currentLine = ""
        let lastY = -1

        sortedItems.forEach((item) => {
          const viewport = page.getViewport({ scale: 1 })
          const currentY = viewport.height - item.transform[5]

          // 如果Y坐标差异较大，认为是新行
          if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
            if (currentLine.trim()) {
              fullText += currentLine.trim() + "\n"
            }
            currentLine = ""
          }

          currentLine += item.str + " "
          lastY = currentY
        })

        // 添加最后一行
        if (currentLine.trim()) {
          fullText += currentLine.trim() + "\n"
        }
      }

      return fullText
    } catch (err) {
      console.error("Error extracting PDF text:", err)
      return ""
    }
  }, [pdfDoc, numPages])

  // 调用DeepSeek API进行批注
  const callDeepSeekAPI = useCallback(async (pdfText: string) => {
    const prompt = `你是一位有着20年教学科研经验的资深本科论文指导教师，请以严谨而耐心的态度对这篇本科生论文进行详细批注。

作为论文指导老师，请从以下角度进行评阅：

1. **论文结构与逻辑**：
   - 检查论文整体框架是否完整（摘要、引言、文献综述、研究方法、结果分析、结论等）
   - 各章节之间的逻辑关系是否清晰
   - 论证过程是否严密，有无逻辑跳跃或断裂
   - 研究问题、研究方法与结论是否一致

2. **学术规范与格式**：
   - 检查论文整体框架是否完整（摘要、引言、文献综述、研究方法、结果分析、结论等）
   - 各章节之间的逻辑关系是否清晰
   - 论证过程是否严密，有无逻辑跳跃或断裂
   - 研究问题、研究方法与结论是否一致

3. **学术写作质量**：
   - 检查论文整体框架是否完整（摘要、引言、文献综述、研究方法、结果分析、结论等）
   - 各章节之间的逻辑关系是否清晰
   - 论证过程是否严密，有无逻辑跳跃或断裂
   - 研究问题、研究方法与结论是否一致

4. **研究内容评估**：
   - 检查论文整体框架是否完整（摘要、引言、文献综述、研究方法、结果分析、结论等）
   - 各章节之间的逻辑关系是否清晰
   - 论证过程是否严密，有无逻辑跳跃或断裂
   - 研究问题、研究方法与结论是否一致

5. **改进指导**：
   - 检查论文整体框架是否完整（摘要、引言、文献综述、研究方法、结果分析、结论等）
   - 各章节之间的逻辑关系是否清晰
   - 论证过程是否严密，有无逻辑跳跃或断裂
   - 研究问题、研究方法与结论是否一致

请以温和而专业的教师语气进行批注，既要指出问题，也要给予鼓励和具体的改进建议。

注意：请严格避免使用任何表情符号、emoji或特殊字符，确保输出内容完全兼容PDF注释格式。

请按照以下自定义格式返回批注结果，每条批注用"---ANNOTATION---"分隔：

格式说明：

---ANNOTATION---
TYPE: 批注类型（structure/format/writing/content/praise）
SEVERITY: 重要程度（high/medium/low）  
PAGE: 页码
TITLE: 批注标题
DESCRIPTION: 详细说明（以教师的语气）
SUGGESTION: 具体修改建议
SELECTED: 请从原文中精确复制2-8个连续字符，确保这些文字在PDF原文中完全一致存在（包括标点符号），不要改写或总结，直接摘取原文片段作为定位锚点。如果无法找到合适的原文片段，请填写"无特定位置"
---ANNOTATION---

重要提醒：SELECTED字段必须是原文的精确复制，不允许任何改写、总结或意译，这是用于在PDF中精确定位批注位置的关键信息。

请开始评阅这篇本科生论文：

${pdfText}`

    try {
      console.log("Calling DeepSeek API with prompt length:", prompt.length)

      const response = await fetch("/api/deepseek", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt,
          model: "deepseek-chat",
        }),
      })

      console.log("API response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error("API request failed:", errorData)

        // Provide specific error messages based on status code
        let errorMessage = "AI服务调用失败"
        if (response.status === 404) {
          errorMessage = "AI服务端点未找到，请检查配置"
        } else if (response.status === 401) {
          errorMessage = "API密钥无效，请检查配置"
        } else if (response.status === 403) {
          errorMessage = "API访问被拒绝，请检查权限"
        } else if (response.status === 429) {
          errorMessage = "API调用频率超限，请稍后重试"
        } else if (response.status >= 500) {
          errorMessage = "AI服务暂时不可用，请稍后重试"
        }

        throw new Error(`${errorMessage} (${response.status})`)
      }

      const data = await response.json()
      console.log("API response data:", data)

      if (!data.content) {
        console.error("No content in API response:", data)
        throw new Error("AI返回数据格式错误：缺少content字段")
      }

      return data.content
    } catch (err) {
      console.error("Error calling DeepSeek API:", err)

      // 如果是网络错误或API错误，提供更详细的错误信息
      if ((err as any).message?.includes("fetch")) {
        throw new Error("网络连接错误，请检查网络连接后重试")
      } else if ((err as any).message?.includes("AI服务")) {
        throw err // 重新抛出API相关错误
      } else {
        throw new Error(`调用AI服务时发生错误: ${(err as any).message}`)
      }
    }
  }, [])

  // 解析批注结果
  const parseAnnotations = useCallback((apiResponse: string) => {
    const annotationBlocks = apiResponse.split("---ANNOTATION---").filter((block) => block.trim())
    const parsedAnnotations: any[] = []

    annotationBlocks.forEach((block, index) => {
      const lines = block.trim().split("\n")
      const annotation: any = {}

      lines.forEach((line) => {
        const [key, ...valueParts] = line.split(":")
        if (key && valueParts.length > 0) {
          const value = valueParts.join(":").trim()
          switch (key.trim().toUpperCase()) {
            case "TYPE":
              annotation.type = value
              break
            case "SEVERITY":
              annotation.severity = value
              break
            case "PAGE":
              annotation.page = Number.parseInt(value) || 1
              break
            case "TITLE":
              annotation.title = value
              break
            case "DESCRIPTION":
              annotation.description = value
              break
            case "SUGGESTION":
              annotation.suggestion = value
              break
            case "SELECTED":
              annotation.selected = value
              break
          }
        }
      })

      if (annotation.title && annotation.description) {
        parsedAnnotations.push({
          id: `auto-${Date.now()}-${index}`,
          ...annotation,
          isAutoGenerated: true,
        })
      }
    })

    return parsedAnnotations
  }, [])



  // 执行自动批注
  const performAutoAnnotation = useCallback(async () => {
    if (!pdfDoc || isAutoAnnotating) return

    setIsAutoAnnotating(true)
    setActiveTab("annotations") // 自动切换到批注标签页
    setAutoAnnotationProgress("正在提取PDF文本...")
    setDebugInfo([]) // 清空调试信息
    setShowDebugPanel(false) // 隐藏调试面板

    try {
      // 1. 提取PDF文本
      const pdfText = await extractPDFText()
      if (!pdfText.trim()) {
        throw new Error("无法提取PDF文本内容")
      }

      setAutoAnnotationProgress("正在调用AI模型生成批注...")

      // 2. 调用DeepSeek API
      const apiResponse = await callDeepSeekAPI(pdfText)

      setAutoAnnotationProgress("正在解析批注结果...")

      // 3. 解析批注结果
      const parsedAnnotations = parseAnnotations(apiResponse)

      if (parsedAnnotations.length === 0) {
        throw new Error("未能解析出有效的批注内容")
      }

      setAutoAnnotationProgress("正在定位批注位置...")

      // 4. 为每个批注找到在PDF中的位置
      const locatedAnnotations: Annotation[] = []
      let successfulLocations = 0
      let failedLocations = 0
      const currentDebugInfo: typeof debugInfo = []

      setDebugInfo([]) // 清空之前的调试信息

      for (const annotation of parsedAnnotations) {
        console.log(`🔍 正在查找文本: "${annotation.selected}" (页面: ${annotation.page})`)
        setAutoAnnotationProgress(`正在定位批注 ${parsedAnnotations.indexOf(annotation) + 1}/${parsedAnnotations.length}: "${annotation.selected.substring(0, 20)}${annotation.selected.length > 20 ? '...' : ''}"`)
        
        // 先在指定页面搜索
        let location = null
        if (annotation.page && annotation.selected !== "无特定位置") {
          console.log(`🎯 首先在页面 ${annotation.page} 搜索: "${annotation.selected}"`)
          location = await searchText({
            query: annotation.selected,
            targetPage: annotation.page,
            returnFirst: true
          })
        }
        
        // 如果指定页面找不到，则搜索全部页面
        if (!location && annotation.selected !== "无特定位置") {
          console.log(`🔍 页面 ${annotation.page} 未找到，搜索全部页面: "${annotation.selected}"`)
          location = await searchText({
            query: annotation.selected,
            returnFirst: true  // 不指定targetPage，搜索全部页面
          })

        if (location) {
            console.log(`✅ 在页面 ${location.pageIndex + 1} 找到文本，而不是AI建议的页面 ${annotation.page}`)
          }
        }

        if (location) {
          successfulLocations++
          const coordinatesInfo = {
            viewport: { x: location.x.toFixed(2), y: location.y.toFixed(2) },
            pdf: { 
              x: location.x.toFixed(2), 
              y: (location.pageSize.height - location.y).toFixed(2) 
            },
            size: { w: location.width.toFixed(2), h: location.height.toFixed(2) },
            pageSize: { 
              w: location.pageSize.width.toFixed(0), 
              h: location.pageSize.height.toFixed(0) 
            }
          }
          
          console.log(`✅ 找到文本位置:`, {
            text: annotation.selected,
            page: location.pageIndex + 1,
            coordinates: coordinatesInfo
          })

          // 添加到调试信息
          currentDebugInfo.push({
            text: annotation.selected,
            page: annotation.page || location.pageIndex + 1,
            found: true,
            coordinates: coordinatesInfo,
            actualPage: location.pageIndex + 1,
            searchStrategy: annotation.page && location.pageIndex + 1 !== annotation.page 
              ? `指定页面(${annotation.page})未找到，全页面搜索成功` 
              : annotation.page 
                ? `指定页面(${annotation.page})搜索成功`
                : `全页面搜索成功`
          })

          // 使用与搜索结果相同的坐标计算方法
          locatedAnnotations.push({
            id: annotation.id,
            pageIndex: location.pageIndex,
            x: location.x,
            y: location.y,
            width: location.width,
            height: location.height,
            content: annotation.title,
            type: "highlight",
            aiAnnotation: {
              selectedText: annotation.selected,
              title: annotation.title,
              description: annotation.description,
              suggestion: annotation.suggestion,
              annotationType: annotation.type,
              severity: annotation.severity,
            },
            // 添加坐标信息，与搜索结果保持一致
            coordinates: {
              pdfCoordinates: {
                x: location.x,
                y: location.pageSize.height - location.y, // 转换为PDF坐标系
                width: location.width,
                height: location.height,
              },
              viewportCoordinates: {
                x: location.x,
                y: location.y,
                width: location.width,
                height: location.height,
              },
              pageSize: location.pageSize,
            },
          })
        } else {
          failedLocations++
          console.log(`❌ 未找到文本: "${annotation.selected}" (页面: ${annotation.page})`)
          
          const pageIndex = Math.max(0, (annotation.page || 1) - 1)
          const existingAnnotationsOnPage = locatedAnnotations.filter((a) => a.pageIndex === pageIndex).length
          const fallbackX = 50
          const fallbackY = 50 + existingAnnotationsOnPage * 30
          
          console.log(`📍 使用默认位置: 页面 ${pageIndex + 1}, 坐标 (${fallbackX}, ${fallbackY})`)
          
          // 添加到调试信息
          currentDebugInfo.push({
            text: annotation.selected,
            page: annotation.page || pageIndex + 1,
            found: false,
            fallbackCoordinates: { x: fallbackX, y: fallbackY },
            searchStrategy: annotation.page 
              ? `指定页面(${annotation.page})和全页面搜索均未找到`
              : `全页面搜索未找到`
          })
          
          locatedAnnotations.push({
            id: annotation.id,
            pageIndex: pageIndex,
            x: fallbackX,
            y: fallbackY,
            width: 100,
            height: 20,
            content: annotation.title,
            type: "highlight",
            aiAnnotation: {
              selectedText: annotation.selected,
              title: annotation.title,
              description: annotation.description,
              suggestion: annotation.suggestion,
              annotationType: annotation.type,
              severity: annotation.severity,
            },
          })
        }
      }

      const directHits = currentDebugInfo.filter(info => info.found && info.actualPage === info.page).length
      const globalSearchHits = currentDebugInfo.filter(info => info.found && info.actualPage !== info.page).length
      
      console.log(`📊 文本定位统计:`)
      console.log(`   总计: ${parsedAnnotations.length} 个批注`)
      console.log(`   成功: ${successfulLocations} 个 (${Math.round(successfulLocations/parsedAnnotations.length*100)}%)`)
      console.log(`   失败: ${failedLocations} 个 (${Math.round(failedLocations/parsedAnnotations.length*100)}%)`)
      console.log(`📍 搜索策略详情:`)
      console.log(`   指定页面直接找到: ${directHits} 个`)
      console.log(`   全页面搜索救援: ${globalSearchHits} 个`)
      console.log(`   完全未找到: ${failedLocations} 个`)

      // 更新调试信息
      setDebugInfo(currentDebugInfo)

      // 5. 添加到批注列表
      setAnnotations((prev) => [...prev, ...locatedAnnotations])

      setAutoAnnotationProgress(`AI批注完成！共生成 ${locatedAnnotations.length} 条批注`)
      
      // 显示调试面板，让用户查看定位结果
      if (currentDebugInfo.length > 0) {
        setShowDebugPanel(true)
      }

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
  }, [pdfDoc, isAutoAnnotating, extractPDFText, callDeepSeekAPI, parseAnnotations, searchText])

  // 缩放控制
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3))
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5))

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
  useEffect(() => {
    if (pdfDoc) {
      // Cancel all ongoing render tasks
      renderTasks.current.forEach((task, pageNumber) => {
        task.cancel()
      })
      renderTasks.current.clear()

      // Clear rendered pages to force re-render
      renderedPages.current.clear()

      // Re-observe all page elements for lazy loading
      setTimeout(() => {
        const pageElements = document.querySelectorAll("[data-page]")
        pageElements.forEach((element) => {
          observerRef.current?.observe(element)
        })
      }, 100)
    }
  }, [scale, pdfDoc])

  // Add cleanup on component unmount
  useEffect(() => {
    return () => {
      // Cancel all render tasks on cleanup
      renderTasks.current.forEach((task) => {
        task.cancel()
      })
      renderTasks.current.clear()
    }
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
                    if (el && observerRef.current) {
                      observerRef.current.observe(el)
                    }
                  }}
                >
                  <canvas
                    ref={(canvas) => {
                      if (canvas) {
                        pageRefs.current.set(pageNumber, canvas)
                      }
                    }}
                    onClick={(e) => handleCanvasClick(e, index)}
                    onMouseMove={(e) => handleMouseMoveCanvas(e, index)}
                    onMouseLeave={handleMouseLeave}
                    className={`w-full ${isAddingAnnotation ? "cursor-crosshair" : "cursor-default"}`}
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
                            title={annotation.aiAnnotation?.title || annotation.content}
                          />
                        )
                      } else {
                        // 回退到原有的计算方法（用于手动添加的注释）
                        return (
                          <div
                            key={annotation.id}
                            className={`absolute border-2 rounded cursor-pointer transition-colors ${
                              annotation.type === "highlight"
                                ? "bg-yellow-200 bg-opacity-30 border-red-400 hover:bg-yellow-300 hover:bg-opacity-40"
                                : "bg-blue-200 bg-opacity-30 border-red-400 hover:bg-blue-300 hover:bg-opacity-40"
                            } ${selectedAnnotation?.id === annotation.id ? "ring-2 ring-blue-500" : ""}`}
                            style={{
                              left: `${(annotation.x / (pageRefs.current.get(pageNumber)?.width || 1)) * 100}%`,
                              top: `${(annotation.y / (pageRefs.current.get(pageNumber)?.height || 1)) * 100}%`,
                              width: `${(annotation.width / (pageRefs.current.get(pageNumber)?.width || 1)) * 100}%`,
                              height: `${(annotation.height / (pageRefs.current.get(pageNumber)?.height || 1)) * 100}%`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedAnnotation(annotation)
                              // 自动滚动到对应的批注项
                              scrollToAnnotationItem(annotation.id)
                            }}
                            title={annotation.aiAnnotation?.title || annotation.content}
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
                                  [{result.coordinates.transform.map((t) => t.toFixed(1)).join(", ")}]
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
                <div className="space-y-2 flex-shrink-0">
                  <Button
                    onClick={() => setIsAddingAnnotation(!isAddingAnnotation)}
                    variant={isAddingAnnotation ? "default" : "outline"}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isAddingAnnotation ? "Cancel Adding" : "Add Manual Annotation"}
                  </Button>

                  {isAddingAnnotation && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Enter annotation content..."
                        value={newAnnotationContent}
                        onChange={(e) => setNewAnnotationContent(e.target.value)}
                        rows={3}
                      />
                      <div className="text-sm text-gray-600">Click on the PDF to place the annotation</div>
                    </div>
                  )}
                </div>

                <div ref={annotationPanelRef} className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-250px)]">
                  {sortAnnotations(annotations).map((annotation) => (
                    <div
                      key={annotation.id}
                      ref={(el) => {
                        if (el) {
                          annotationItemRefs.current.set(annotation.id, el)
                        } else {
                          annotationItemRefs.current.delete(annotation.id)
                        }
                      }}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedAnnotation?.id === annotation.id
                          ? "bg-blue-50 border-blue-300"
                          : "hover:bg-gray-50 border-gray-200"
                      }`}
                      onClick={() => {
                        setSelectedAnnotation(annotation)
                        // 当在批注面板中点击批注项时，也滚动到对应的PDF位置
                        const pageElement = document.getElementById(`page-${annotation.pageIndex + 1}`)
                        if (pageElement) {
                          pageElement.scrollIntoView({ behavior: "smooth", block: "center" })
                        }
                      }}
                    >
                      {/* 基本信息 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Page {annotation.pageIndex + 1}
                          </Badge>
                          {annotation.aiAnnotation && (
                            <>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  annotation.aiAnnotation.severity === "high"
                                    ? "bg-red-50 text-red-700"
                                    : annotation.aiAnnotation.severity === "medium"
                                      ? "bg-yellow-50 text-yellow-700"
                                      : "bg-green-50 text-green-700"
                                }`}
                              >
                                {annotation.aiAnnotation.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                {annotation.aiAnnotation.annotationType}
                              </Badge>
                            </>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAnnotations((prev) => prev.filter((a) => a.id !== annotation.id))
                          }}
                          className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                        >
                          ×
                        </Button>
                      </div>

                      {annotation.aiAnnotation ? (
                        /* AI批注详细信息 */
                        <div className="space-y-3">
                          {/* 选中文字 */}
                          {annotation.aiAnnotation.selectedText &&
                            annotation.aiAnnotation.selectedText !== "无特定位置" && (
                              <div>
                                <div className="text-xs font-medium text-gray-600 mb-1">选中文字:</div>
                                <div className="text-sm bg-yellow-50 p-2 rounded border-l-2 border-yellow-400">
                                  "{annotation.aiAnnotation.selectedText}"
                                </div>
                              </div>
                            )}

                          {/* 标题 */}
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">批注标题:</div>
                            <div className="text-sm font-medium text-gray-800">{annotation.aiAnnotation.title}</div>
                          </div>

                          {/* 存在问题 - 可编辑 */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs font-medium text-gray-600">存在问题:</div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (editingAnnotation === annotation.id) {
                                    // 保存编辑
                                    setAnnotations((prev) =>
                                      prev.map((a) =>
                                        a.id === annotation.id
                                          ? {
                                              ...a,
                                              aiAnnotation: {
                                                ...a.aiAnnotation!,
                                                description: editingDescription,
                                              },
                                            }
                                          : a,
                                      ),
                                    )
                                    setEditingAnnotation(null)
                                  } else {
                                    // 开始编辑
                                    setEditingAnnotation(annotation.id)
                                    setEditingDescription(annotation.aiAnnotation?.description || "")
                                  }
                                }}
                                className="h-6 text-xs"
                              >
                                {editingAnnotation === annotation.id ? "保存" : "编辑"}
                              </Button>
                            </div>
                            {editingAnnotation === annotation.id ? (
                              <Textarea
                                value={editingDescription}
                                onChange={(e) => setEditingDescription(e.target.value)}
                                className="text-sm"
                                rows={3}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div className="text-sm text-gray-700 bg-red-50 p-2 rounded border-l-2 border-red-400">
                                {annotation.aiAnnotation.description}
                              </div>
                            )}
                          </div>

                          {/* 修改建议 - 可编辑 */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs font-medium text-gray-600">修改建议:</div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (editingAnnotation === `${annotation.id}-suggestion`) {
                                    // 保存编辑
                                    setAnnotations((prev) =>
                                      prev.map((a) =>
                                        a.id === annotation.id
                                          ? {
                                              ...a,
                                              aiAnnotation: {
                                                ...a.aiAnnotation!,
                                                suggestion: editingSuggestion,
                                              },
                                            }
                                          : a,
                                      ),
                                    )
                                    setEditingAnnotation(null)
                                  } else {
                                    // 开始编辑
                                    setEditingAnnotation(`${annotation.id}-suggestion`)
                                    setEditingSuggestion(annotation.aiAnnotation?.suggestion || "")
                                  }
                                }}
                                className="h-6 text-xs"
                              >
                                {editingAnnotation === `${annotation.id}-suggestion` ? "保存" : "编辑"}
                              </Button>
                            </div>
                            {editingAnnotation === `${annotation.id}-suggestion` ? (
                              <Textarea
                                value={editingSuggestion}
                                onChange={(e) => setEditingSuggestion(e.target.value)}
                                className="text-sm"
                                rows={3}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div className="text-sm text-gray-700 bg-green-50 p-2 rounded border-l-2 border-green-400">
                                {annotation.aiAnnotation.suggestion}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* 手动批注 */
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1">手动批注:</div>
                          <div className="text-sm text-gray-700">{annotation.content}</div>
                        </div>
                      )}
                    </div>
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
