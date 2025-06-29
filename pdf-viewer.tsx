"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, MessageSquare, ZoomIn, ZoomOut, MapPin } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

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

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const renderedPages = useRef<Set<number>>(new Set())

  // Add render task tracking
  const renderTasks = useRef<Map<number, PDFRenderTask>>(new Map())

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
      } catch (err) {
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
        // Load PDF.js from CDN to ensure version consistency
        const script = document.createElement("script")
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        script.onload = async () => {
          // Access PDF.js from global window object
          const pdfjsLib = (window as any).pdfjsLib

          // Set worker with matching version
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"

          try {
            // Load PDF document
            const loadingTask = pdfjsLib.getDocument({
              url: PDF_URL,
              cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
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

        script.onerror = () => {
          console.error("Error loading PDF.js library")
          setError("Failed to load PDF.js library")
          setLoading(false)
        }

        document.head.appendChild(script)

        // Cleanup function
        return () => {
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

  // 搜索文本
  const searchText = useCallback(async () => {
    if (!pdfDoc || !searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const results: SearchResult[] = []
    const query = searchQuery.toLowerCase()

    try {
      for (let pageIndex = 1; pageIndex <= numPages; pageIndex++) {
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
            if (item.str.toLowerCase().includes(query)) {
              // 获取变换矩阵信息
              const transform = item.transform

              // PDF原始坐标系统 (左下角为原点)
              const pdfX = transform[4]
              const pdfY = transform[5]

              // 视口坐标系统 (左上角为原点) - 修正计算方法
              const viewportX = pdfX
              const viewportY = viewport.height - pdfY

              // 计算相对位置百分比
              const xPercent = (pdfX / viewport.width) * 100
              const yPercent = (viewportY / viewport.height) * 100

              // 获取上下文 - 前后各取一些文本
              const paragraphText = paragraph.map((p) => p.str).join(" ")
              const itemPosition = paragraph.indexOf(item)
              const contextStart = Math.max(0, itemPosition - 2)
              const contextEnd = Math.min(paragraph.length, itemPosition + 3)
              const context = paragraph
                .slice(contextStart, contextEnd)
                .map((p) => p.str)
                .join(" ")

              results.push({
                pageIndex: pageIndex - 1,
                textIndex,
                paragraphIndex: paragraphIndex + 1,
                text: item.str,
                x: viewportX, // 使用视口坐标作为显示坐标
                y: viewportY, // 使用视口坐标作为显示坐标
                width: item.width,
                height: item.height,
                context: context.length > 100 ? context.substring(0, 100) + "..." : context,
                coordinates: {
                  pdfCoordinates: {
                    x: pdfX,
                    y: pdfY,
                    width: item.width,
                    height: item.height,
                  },
                  viewportCoordinates: {
                    x: viewportX,
                    y: viewportY,
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
              })
            }
          })
        })
      }

      setSearchResults(results)
      setCurrentSearchIndex(results.length > 0 ? 0 : -1)
    } catch (err) {
      console.error("Error searching text:", err)
    }
  }, [pdfDoc, searchQuery, numPages])

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
      if (err.message.includes("fetch")) {
        throw new Error("网络连接错误，请检查网络连接后重试")
      } else if (err.message.includes("AI服务")) {
        throw err // 重新抛出API相关错误
      } else {
        throw new Error(`调用AI服务时发生错误: ${err.message}`)
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

  // 在PDF中搜索并定位文本
  const findTextInPDF = useCallback(
    async (searchText: string, targetPage?: number) => {
      if (!pdfDoc || !searchText || searchText === "无特定位置") return null

      try {
        const startPage = targetPage || 1
        const endPage = targetPage || numPages

        for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
          const page = await pdfDoc.getPage(pageIndex)
          const textContent = await page.getTextContent()
          const viewport = page.getViewport({ scale: 1 }) // 使用scale 1获取原始坐标
          const textItems = textContent.items as TextItem[]

          // 在当前页面搜索文本
          for (let i = 0; i < textItems.length; i++) {
            const item = textItems[i]
            if (item.str.includes(searchText)) {
              const transform = item.transform
              const pdfX = transform[4]
              const pdfY = transform[5]
              const viewportX = pdfX
              const viewportY = viewport.height - pdfY

              return {
                pageIndex: pageIndex - 1,
                x: viewportX,
                y: viewportY,
                width: item.width,
                height: item.height,
                text: item.str,
                pageSize: {
                  width: viewport.width,
                  height: viewport.height,
                },
              }
            }
          }

          // 如果单个文本项中没找到，尝试组合文本搜索
          let combinedText = ""

          for (let i = 0; i < textItems.length; i++) {
            combinedText += textItems[i].str

            if (combinedText.includes(searchText)) {
              const item = textItems[Math.max(0, i - 3)] // 取前面几个字符的位置
              const transform = item.transform
              const pdfX = transform[4]
              const pdfY = transform[5]
              const viewportX = pdfX
              const viewportY = viewport.height - pdfY

              return {
                pageIndex: pageIndex - 1,
                x: viewportX,
                y: viewportY,
                width: item.width,
                height: item.height,
                text: searchText,
                pageSize: {
                  width: viewport.width,
                  height: viewport.height,
                },
              }
            }

            // 限制组合文本长度，避免内存问题
            if (combinedText.length > 1000) {
              combinedText = combinedText.slice(-500)
            }
          }
        }

        return null
      } catch (err) {
        console.error("Error finding text in PDF:", err)
        return null
      }
    },
    [pdfDoc, numPages],
  )

  // 执行自动批注
  const performAutoAnnotation = useCallback(async () => {
    if (!pdfDoc || isAutoAnnotating) return

    setIsAutoAnnotating(true)
    setAutoAnnotationProgress("正在提取PDF文本...")

    try {
      // 1. 提取PDF文本
      const pdfText = await extractPDFText()
      if (!pdfText.trim()) {
        throw new Error("无法提取PDF文本内容")
      }

      setAutoAnnotationProgress("正在调用AI模型生成批注...")

      let apiResponse
      let usingFallback = false

      try {
        // 2. 调用DeepSeek API
        apiResponse = await callDeepSeekAPI(pdfText)
      } catch (apiError) {
        console.error("AI API调用失败，使用演示批注:", apiError)
        usingFallback = true

        // 如果API调用失败，提供更智能的演示批注
        apiResponse = `---ANNOTATION---
TYPE: structure
SEVERITY: medium
PAGE: 1
TITLE: 论文整体结构评估
DESCRIPTION: 同学你好，从整体来看，这篇论文涉及了一个很有意义的研究主题。建议进一步完善论文的整体结构，确保各个部分之间的逻辑关系更加清晰。特别是要注意引言部分对研究背景的阐述，以及结论部分对研究成果的总结。
SUGGESTION: 建议按照标准学术论文格式重新组织内容：1）完善摘要部分，突出研究的创新点；2）加强引言部分的文献综述；3）详细描述研究方法；4）充实结果分析；5）深化结论讨论。
SELECTED: 无特定位置
---ANNOTATION---

---ANNOTATION---
TYPE: format
SEVERITY: medium
PAGE: 1
TITLE: 学术规范需要注意
DESCRIPTION: 在学术写作中，格式规范非常重要。请注意标题的层级结构，确保一级标题、二级标题的格式统一。同时，如果有图表，请确保都有规范的标题和编号。
SUGGESTION: 1）统一标题格式，建议使用1、1.1、1.1.1的编号方式；2）检查所有图表是否有标题和编号；3）确保参考文献格式符合学术要求；4）检查引用标注是否完整准确。
SELECTED: 无特定位置
---ANNOTATION---

---ANNOTATION---
TYPE: writing
SEVERITY: low
PAGE: 1
TITLE: 语言表达建议
DESCRIPTION: 论文的语言表达总体来说是清晰的，但在某些地方可以更加学术化。建议避免使用过于口语化的表达，多使用学术写作中的正式用词。
SUGGESTION: 1）避免使用"很多"、"非常"等口语化词汇，改用"大量"、"显著"等学术用词；2）多使用被动语态和客观表述；3）注意句式的多样性，避免句式过于单一；4）确保专业术语使用准确。
SELECTED: 无特定位置
---ANNOTATION---

---ANNOTATION---
TYPE: content
SEVERITY: high
PAGE: 1
TITLE: 研究内容深度建议
DESCRIPTION: 你选择的研究主题很有价值，但需要进一步深化研究内容。建议加强理论分析的深度，并提供更多的实证支持。
SUGGESTION: 1）加强文献综述，展示对该领域研究现状的深入了解；2）明确研究假设和研究问题；3）详细描述研究方法和数据来源；4）提供更充分的数据分析和讨论；5）明确研究的理论贡献和实践意义。
SELECTED: 无特定位置
---ANNOTATION---

---ANNOTATION---
TYPE: praise
SEVERITY: low
PAGE: 1
TITLE: 研究主题选择很好
DESCRIPTION: 首先要肯定的是，你选择的研究主题很有现实意义和学术价值。这体现了你对学术前沿的敏感性和对实际问题的关注，这是做好学术研究的重要基础。
SUGGESTION: 继续保持这种学术敏感性，可以进一步拓展研究的广度和深度。建议多关注国内外相关研究的最新进展，为你的研究提供更坚实的理论基础。
SELECTED: 无特定位置
---ANNOTATION---`

        setAutoAnnotationProgress(`AI服务暂时不可用，使用演示批注... (${apiError.message})`)
      }

      setAutoAnnotationProgress("正在解析批注结果...")

      // 3. 解析批注结果
      const parsedAnnotations = parseAnnotations(apiResponse)

      if (parsedAnnotations.length === 0) {
        throw new Error("未能解析出有效的批注内容")
      }

      setAutoAnnotationProgress("正在定位批注位置...")

      // 4. 为每个批注找到在PDF中的位置
      const locatedAnnotations: Annotation[] = []

      for (const annotation of parsedAnnotations) {
        const location = await findTextInPDF(annotation.selected, annotation.page)

        if (location) {
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
          const pageIndex = Math.max(0, (annotation.page || 1) - 1)
          const existingAnnotationsOnPage = locatedAnnotations.filter((a) => a.pageIndex === pageIndex).length
          locatedAnnotations.push({
            id: annotation.id,
            pageIndex: pageIndex,
            x: 50,
            y: 50 + existingAnnotationsOnPage * 30,
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

      // 5. 添加到批注列表
      setAnnotations((prev) => [...prev, ...locatedAnnotations])

      const statusMessage = usingFallback
        ? `演示批注完成！共生成 ${locatedAnnotations.length} 条批注 (AI服务暂时不可用)`
        : `AI批注完成！共生成 ${locatedAnnotations.length} 条批注`

      setAutoAnnotationProgress(statusMessage)

      // 5秒后清除进度信息
      setTimeout(() => {
        setAutoAnnotationProgress("")
      }, 5000)
    } catch (err) {
      console.error("Auto annotation error:", err)
      setAutoAnnotationProgress(`批注失败：${err.message}`)

      setTimeout(() => {
        setAutoAnnotationProgress("")
      }, 8000)
    } finally {
      setIsAutoAnnotating(false)
    }
  }, [pdfDoc, isAutoAnnotating, extractPDFText, callDeepSeekAPI, parseAnnotations, findTextInPDF])

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
                        const highlightHeight = annotation.coordinates.viewportCoordinates.height * scaleRatio

                        return (
                          <div
                            key={annotation.id}
                            className={`absolute border-2 rounded cursor-pointer transition-colors ${
                              annotation.type === "highlight"
                                ? "bg-yellow-200 bg-opacity-50 border-yellow-400 hover:bg-yellow-300"
                                : "bg-blue-200 bg-opacity-50 border-blue-400 hover:bg-blue-300"
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
                                ? "bg-yellow-200 bg-opacity-50 border-yellow-400 hover:bg-yellow-300"
                                : "bg-blue-200 bg-opacity-50 border-blue-400 hover:bg-blue-300"
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
                      const highlightHeight = result.coordinates.viewportCoordinates.height * scaleRatio

                      return (
                        <div
                          key={resultIndex}
                          className={`absolute pointer-events-none ${
                            isCurrentResult ? "bg-yellow-300 border-yellow-500" : "bg-yellow-200 border-yellow-400"
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
        {/* 侧边栏内容保持不变 */}
        {/* 搜索区域 */}
        <Card className="m-4">
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
                onKeyPress={(e) => e.key === "Enter" && searchText()}
              />
              <Button onClick={searchText} size="sm">
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

        {/* 注释区域 */}
        <Card className="m-4 flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Annotations ({annotations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
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

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedAnnotation?.id === annotation.id
                      ? "bg-blue-50 border-blue-300"
                      : "hover:bg-gray-50 border-gray-200"
                  }`}
                  onClick={() => setSelectedAnnotation(annotation)}
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
                                setEditingDescription(annotation.aiAnnotation.description)
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
                                setEditingSuggestion(annotation.aiAnnotation.suggestion)
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
      </div>
    </div>
  )
}
