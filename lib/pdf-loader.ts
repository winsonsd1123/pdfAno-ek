import type { PDFDocumentProxy, PDFLoadConfig } from './pdf-types'

// PDF.js全局配置常量
const PDFJS_CONFIG = {
  cdnVersion: '5.3.31',
  workerSrc: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.worker.min.mjs',
  mainSrc: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.min.mjs',
  cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/cmaps/',
  cMapPacked: true
}

/**
 * PDF加载器类
 * 负责PDF.js的初始化和PDF文档的加载管理
 */
export class PDFLoader {
  private static instance: PDFLoader | null = null
  private isInitialized = false
  private initPromise: Promise<void> | null = null
  private pdfjsLib: any = null

  private constructor() {}

  /**
   * 获取PDF加载器单例实例
   */
  static getInstance(): PDFLoader {
    if (!PDFLoader.instance) {
      PDFLoader.instance = new PDFLoader()
    }
    return PDFLoader.instance
  }

  /**
   * 初始化PDF.js库
   * @returns Promise that resolves when PDF.js is loaded
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve()
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.loadPDFJS()
    await this.initPromise
    this.isInitialized = true
  }

  /**
   * 动态加载PDF.js库
   * @private
   */
  private async loadPDFJS(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 创建脚本标签加载PDF.js
        const script = document.createElement("script")
        script.type = "module"
        script.innerHTML = `
          import * as pdfjsLib from '${PDFJS_CONFIG.mainSrc}';
          
          // 设置Worker
          pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_CONFIG.workerSrc}';
          
          // 使PDF.js全局可用
          window.pdfjsLib = pdfjsLib;
          
          // 触发加载完成事件
          window.dispatchEvent(new CustomEvent('pdfjsLoaded'));
        `
        
        // 监听加载完成事件
        const handlePdfjsLoaded = () => {
          try {
            this.pdfjsLib = (window as any).pdfjsLib
            if (!this.pdfjsLib) {
              throw new Error("PDF.js library not available after loading")
            }
            window.removeEventListener('pdfjsLoaded', handlePdfjsLoaded)
            resolve()
          } catch (err) {
            console.error("Error setting up PDF.js after load:", err)
            reject(new Error("Failed to initialize PDF.js library"))
          }
        }

        // 添加事件监听器
        window.addEventListener('pdfjsLoaded', handlePdfjsLoaded, { once: true })

        // 设置错误处理
        script.onerror = () => {
          window.removeEventListener('pdfjsLoaded', handlePdfjsLoaded)
          console.error("Error loading PDF.js library")
          reject(new Error("Failed to load PDF.js library from CDN"))
        }

        // 添加脚本到页面
        document.head.appendChild(script)

        // 设置超时处理
        setTimeout(() => {
          if (!this.isInitialized) {
            window.removeEventListener('pdfjsLoaded', handlePdfjsLoaded)
            reject(new Error("PDF.js loading timeout"))
          }
        }, 10000) // 10秒超时

      } catch (err) {
        console.error("Error setting up PDF.js loading:", err)
        reject(new Error("Failed to initialize PDF.js loading"))
      }
    })
  }

  /**
   * 加载PDF文档
   * @param config PDF加载配置
   * @returns Promise that resolves to PDF document proxy
   */
  async loadDocument(config: PDFLoadConfig): Promise<PDFDocumentProxy> {
    // 确保PDF.js已初始化
    await this.initialize()

    if (!this.pdfjsLib) {
      throw new Error("PDF.js library not initialized")
    }

    try {
      // 准备加载配置
      const loadConfig = {
        url: config.url,
        cMapUrl: config.cMapUrl || PDFJS_CONFIG.cMapUrl,
        cMapPacked: config.cMapPacked !== undefined ? config.cMapPacked : PDFJS_CONFIG.cMapPacked,
        ...this.getLoadingOptions(config)
      }

      console.log("Loading PDF document with config:", {
        url: loadConfig.url,
        cMapUrl: loadConfig.cMapUrl,
        cMapPacked: loadConfig.cMapPacked
      })

      // 创建加载任务
      const loadingTask = this.pdfjsLib.getDocument(loadConfig)

      // 监听加载进度（可选）
      loadingTask.onProgress = (progress: { loaded: number; total: number }) => {
        if (progress.total > 0) {
          const percent = Math.round((progress.loaded / progress.total) * 100)
          console.log(`PDF loading progress: ${percent}%`)
        }
      }

      // 等待文档加载完成
      const pdfDocument = await loadingTask.promise
      console.log(`PDF loaded successfully. Pages: ${pdfDocument.numPages}`)

      return pdfDocument as PDFDocumentProxy

    } catch (error: any) {
      console.error("Error loading PDF document:", error)
      
      // 提供更详细的错误信息
      let errorMessage = "Failed to load PDF document"
      
      if (error.name === "InvalidPDFException") {
        errorMessage = "Invalid PDF file format"
      } else if (error.name === "MissingPDFException") {
        errorMessage = "PDF file not found"
      } else if (error.name === "UnexpectedResponseException") {
        errorMessage = "Network error while loading PDF"
      } else if (error.message?.includes("fetch")) {
        errorMessage = "Network connection error"
      } else if (error.message?.includes("CORS")) {
        errorMessage = "Cross-origin request blocked"
      }

      throw new Error(`${errorMessage}: ${error.message}`)
    }
  }

  /**
   * 获取PDF.js加载选项
   * @param config 用户配置
   * @returns 加载选项对象
   * @private
   */
  private getLoadingOptions(config: PDFLoadConfig): object {
    const options: any = {}

    // 设置字体相关选项
    options.useSystemFonts = true
    options.standardFontDataUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_CONFIG.cdnVersion}/standard_fonts/`

    // 设置性能选项
    options.disableAutoFetch = false
    options.disableStream = false
    options.disableRange = false

    // 安全选项
    options.isEvalSupported = false

    return options
  }

  /**
   * 检查PDF.js是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized && this.pdfjsLib !== null
  }

  /**
   * 获取PDF.js库版本信息
   */
  getVersion(): string {
    if (!this.pdfjsLib) {
      return "Not loaded"
    }
    return this.pdfjsLib.version || PDFJS_CONFIG.cdnVersion
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 这里可以添加清理逻辑，如取消正在进行的加载任务
    console.log("PDF loader cleanup")
  }
}

/**
 * 便利函数：加载PDF文档
 * @param url PDF文件URL
 * @param options 可选配置
 * @returns Promise that resolves to PDF document proxy
 */
export async function loadPDFDocument(
  url: string, 
  options?: Partial<PDFLoadConfig>
): Promise<PDFDocumentProxy> {
  const loader = PDFLoader.getInstance()
  const config: PDFLoadConfig = {
    url,
    ...options
  }
  return loader.loadDocument(config)
}

/**
 * 便利函数：检查PDF.js是否可用
 * @returns Promise that resolves to true when PDF.js is ready
 */
export async function ensurePDFJSReady(): Promise<boolean> {
  const loader = PDFLoader.getInstance()
  await loader.initialize()
  return loader.isReady()
}

/**
 * 便利函数：获取PDF.js版本
 * @returns PDF.js版本字符串
 */
export function getPDFJSVersion(): string {
  const loader = PDFLoader.getInstance()
  return loader.getVersion()
} 