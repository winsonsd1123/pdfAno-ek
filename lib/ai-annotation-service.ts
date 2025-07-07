import type { 
  PDFDocumentProxy,
  Annotation, 
  SearchResult,
  CoordinateInfo,
  AIAnnotationRawData,
  AIAnnotationConfig,
  AIAnnotationProgressCallback,
  AIAnnotationLocationResult,
  DebugInfo
} from './pdf-types'

import { parseAIAnnotationResponse, getParseStatistics } from './ai-annotation-parser'
import { callDeepSeekAPI, validateAPIConfig } from './ai-annotation-api'
import { 
  mergeAnnotationContent, 
  addDefaultAuthorInfo, 
  getCurrentTimestamp
} from './annotation-utils'
import { 
  createCoordinatesFromLegacy as createCoordinatesFromLegacyUtil
} from './pdf-coordinate-utils'

/**
 * AI批注服务类
 * 
 * 主要的AI批注业务逻辑服务，集成文本提取、API调用、解析、定位等功能
 * 参考PDFTextExtractor的设计模式，提供完整的AI批注解决方案
 */

export interface AIAnnotationServiceOptions {
  config?: Partial<AIAnnotationConfig>
  onProgress?: AIAnnotationProgressCallback
  onDebugInfo?: (info: DebugInfo[]) => void
}

export class AIAnnotationService {
  private pdfDoc: PDFDocumentProxy | null = null
  private textExtractor: any = null
  private searchFunction: any = null
  private options: AIAnnotationServiceOptions
  private isProcessing = false

  constructor(options: AIAnnotationServiceOptions = {}) {
    this.options = options
    
    // 验证配置
    if (options.config && !validateAPIConfig(options.config)) {
      console.warn("⚠️ AI批注配置验证失败，将使用默认配置")
    }
  }

  /**
   * 初始化服务
   * @param pdfDoc - PDF文档代理
   * @param textExtractor - 文本提取器实例
   * @param searchFunction - 搜索函数
   */
  initialize(pdfDoc: PDFDocumentProxy, textExtractor: any, searchFunction: any): void {
    this.pdfDoc = pdfDoc
    this.textExtractor = textExtractor
    this.searchFunction = searchFunction
    console.log("✅ AI批注服务初始化完成")
  }

  /**
   * 执行自动批注主流程
   * @returns 生成的批注数组
   */
  async performAutoAnnotation(): Promise<Annotation[]> {
    if (!this.pdfDoc || !this.textExtractor || !this.searchFunction) {
      throw new Error("AI批注服务未正确初始化")
    }

    if (this.isProcessing) {
      console.warn("⚠️ 已有AI批注任务正在进行中")
      return []
    }

    this.isProcessing = true
    const debugInfo: DebugInfo[] = []

    try {
      this.reportProgress("正在提取PDF文本...")

      // 1. 提取PDF文本
      const pdfText = await this.extractPDFText()
      if (!pdfText.trim()) {
        throw new Error("无法提取PDF文本内容")
      }

      this.reportProgress("正在调用AI模型生成批注...")

      // 2. 调用AI API
      const apiResponse = await callDeepSeekAPI(pdfText, this.options.config)

      this.reportProgress("正在解析批注结果...")

      // 3. 解析批注结果
      const parsedAnnotations = parseAIAnnotationResponse(apiResponse.content)

      if (parsedAnnotations.length === 0) {
        throw new Error("未能解析出有效的批注内容")
      }

      // 打印解析统计
      const stats = getParseStatistics(apiResponse.content, parsedAnnotations)
      console.log("📊 解析统计:", stats)

      this.reportProgress("正在定位批注位置...")

      // 4. 为每个批注找到在PDF中的位置
      const locationResults = await this.locateAnnotations(parsedAnnotations, debugInfo)
      
      // 5. 生成最终的批注对象
      const finalAnnotations = await this.createFinalAnnotations(locationResults)

      // 报告完成情况
      const successfulLocations = locationResults.filter(r => r.success).length
      this.reportProgress(`AI批注完成！共生成 ${finalAnnotations.length} 条批注`)
      
      // 报告调试信息
      if (this.options.onDebugInfo) {
        this.options.onDebugInfo(debugInfo)
      }

      console.log("📊 AI批注统计:")
      console.log(`   总计: ${parsedAnnotations.length} 个批注`)
      console.log(`   成功定位: ${successfulLocations} 个 (${Math.round(successfulLocations/parsedAnnotations.length*100)}%)`)
      console.log(`   使用默认位置: ${parsedAnnotations.length - successfulLocations} 个`)

      return finalAnnotations

    } catch (error) {
      console.error("❌ AI批注过程发生错误:", error)
      this.reportProgress(`批注失败：${(error as any).message}`)
      throw error
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 提取PDF全文内容
   * @returns PDF文本
   */
  private async extractPDFText(): Promise<string> {
    if (!this.textExtractor) {
      throw new Error("文本提取器未初始化")
    }

    try {
      return await this.textExtractor.extractFullText()
    } catch (err) {
      console.error("使用文本提取器提取全文失败:", err)
      throw new Error("PDF文本提取失败")
    }
  }

  /**
   * 为批注数组进行位置定位
   * @param annotations - 解析后的批注数组
   * @param debugInfo - 调试信息数组
   * @returns 定位结果数组
   */
  private async locateAnnotations(
    annotations: AIAnnotationRawData[], 
    debugInfo: DebugInfo[]
  ): Promise<AIAnnotationLocationResult[]> {
    const results: AIAnnotationLocationResult[] = []

    for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i]
      
      this.reportProgress(
        `正在定位批注 ${i + 1}/${annotations.length}: "${annotation.selected.substring(0, 20)}${annotation.selected.length > 20 ? '...' : ''}"`
      )

      const result = await this.locateAnnotation(annotation, debugInfo)
      results.push(result)
    }

    return results
  }

  /**
   * 为单个批注进行位置定位
   * @param annotation - 批注数据
   * @param debugInfo - 调试信息数组
   * @returns 定位结果
   */
  private async locateAnnotation(
    annotation: AIAnnotationRawData, 
    debugInfo: DebugInfo[]
  ): Promise<AIAnnotationLocationResult> {
    console.log(`🔍 正在查找文本: "${annotation.selected}" (页面: ${annotation.page})`)

    let location: SearchResult | null = null
    let strategy = ""

    // 先在指定页面搜索
    if (annotation.page && annotation.selected !== "无特定位置") {
      console.log(`🎯 首先在页面 ${annotation.page} 搜索: "${annotation.selected}"`)
      location = await this.searchFunction({
        query: annotation.selected,
        targetPage: annotation.page,
        returnFirst: true
      })
      
      if (location) {
        strategy = `指定页面(${annotation.page})搜索成功`
      }
    }

    // 如果指定页面找不到，则搜索全部页面
    if (!location && annotation.selected !== "无特定位置") {
      console.log(`🔍 页面 ${annotation.page} 未找到，搜索全部页面: "${annotation.selected}"`)
      location = await this.searchFunction({
        query: annotation.selected,
        returnFirst: true
      })

      if (location) {
        strategy = annotation.page && location.pageIndex + 1 !== annotation.page 
          ? `指定页面(${annotation.page})未找到，全页面搜索成功`
          : `全页面搜索成功`
        console.log(`✅ 在页面 ${location.pageIndex + 1} 找到文本，而不是AI建议的页面 ${annotation.page}`)
      }
    }

    // 构建调试信息
    const debugEntry: DebugInfo = {
      text: annotation.selected,
      page: annotation.page || 1,
      found: !!location,
      actualPage: location ? location.pageIndex + 1 : undefined,
      searchStrategy: strategy || `全页面搜索未找到`
    }

    if (location) {
      debugEntry.coordinates = {
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
      console.log(`✅ 找到文本位置:`, debugEntry.coordinates)
    } else {
      const pageIndex = Math.max(0, (annotation.page || 1) - 1)
      const fallbackX = 50
      const fallbackY = 50
      debugEntry.fallbackCoordinates = { x: fallbackX, y: fallbackY }
      console.log(`❌ 未找到文本: "${annotation.selected}" (页面: ${annotation.page})`)
      console.log(`📍 使用默认位置: 页面 ${pageIndex + 1}, 坐标 (${fallbackX}, ${fallbackY})`)
    }

    debugInfo.push(debugEntry)

    // 创建坐标信息
    let coordinates: CoordinateInfo | null = null
    
    if (location) {
      coordinates = {
        pdfCoordinates: {
          x: location.x,
          y: location.pageSize.height - location.y,
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
      }
    }

    return {
      annotation,
      location,
      coordinates,
      strategy,
      success: !!location
    }
  }

  /**
   * 根据定位结果创建最终的批注对象
   * @param locationResults - 定位结果数组
   * @returns 最终批注数组
   */
  private async createFinalAnnotations(
    locationResults: AIAnnotationLocationResult[]
  ): Promise<Annotation[]> {
    const finalAnnotations: Annotation[] = []

    for (const result of locationResults) {
      const { annotation, location, coordinates, success } = result

      // 合并批注内容
      const mergedContent = mergeAnnotationContent({
        selectedText: annotation.selected,
        title: annotation.title,
        description: annotation.description,
        suggestion: annotation.suggestion,
        annotationType: annotation.type,
        severity: annotation.severity,
      })

      let finalCoordinates: CoordinateInfo

      if (success && location && coordinates) {
        // 使用成功定位的坐标
        finalCoordinates = coordinates
      } else {
        // 使用默认坐标
        const pageIndex = Math.max(0, (annotation.page || 1) - 1)
        const existingCount = finalAnnotations.filter(a => a.pageIndex === pageIndex).length
        const fallbackX = 50
        const fallbackY = 50 + existingCount * 30

        const fallbackCoordinates = await createCoordinatesFromLegacyUtil({
          x: fallbackX,
          y: fallbackY,
          width: 100,
          height: 20,
          pageIndex: pageIndex
        })

        finalCoordinates = fallbackCoordinates || {
          pdfCoordinates: { x: fallbackX, y: fallbackY, width: 100, height: 20 },
          viewportCoordinates: { x: fallbackX, y: fallbackY, width: 100, height: 20 },
          pageSize: { width: 612, height: 792 }
        }
      }

      const finalAnnotation: Annotation = {
        id: annotation.id,
        pageIndex: location ? location.pageIndex : Math.max(0, (annotation.page || 1) - 1),
        x: location ? location.x : 50,
        y: location ? location.y : 50 + finalAnnotations.filter(a => a.pageIndex === Math.max(0, (annotation.page || 1) - 1)).length * 30,
        width: location ? location.width : 100,
        height: location ? location.height : 20,
        content: annotation.title,
        type: "highlight",
        author: addDefaultAuthorInfo("AI助手"),
        timestamp: getCurrentTimestamp(),
        isExpanded: false,
        aiAnnotation: {
          selectedText: annotation.selected,
          mergedContent: mergedContent,
          originalData: {
            title: annotation.title,
            description: annotation.description,
            suggestion: annotation.suggestion,
            annotationType: annotation.type,
            severity: annotation.severity,
          }
        },
        coordinates: finalCoordinates,
      }

      finalAnnotations.push(finalAnnotation)
    }

    return finalAnnotations
  }

  /**
   * 报告进度
   * @param message - 进度消息
   */
  private reportProgress(message: string): void {
    console.log("🔄", message)
    if (this.options.onProgress) {
      this.options.onProgress(message)
    }
  }

  /**
   * 检查服务是否正在处理
   * @returns 是否正在处理
   */
  isProcessing(): boolean {
    return this.isProcessing
  }

  /**
   * 销毁服务实例
   */
  destroy(): void {
    this.pdfDoc = null
    this.textExtractor = null
    this.searchFunction = null
    this.isProcessing = false
    console.log("🗑️ AI批注服务已销毁")
  }
}

/**
 * 创建AI批注服务实例的工厂函数
 * @param options - 服务选项
 * @returns AI批注服务实例
 */
export function createAIAnnotationService(options: AIAnnotationServiceOptions = {}): AIAnnotationService {
  return new AIAnnotationService(options)
} 