import type { 
  PDFDocumentProxy, 
  PDFPageProxy, 
  PDFRenderTask,
  RenderConfig 
} from './pdf-types'

/**
 * PDF渲染器类
 * 负责PDF页面的渲染、懒加载和缩放控制
 */
export class PDFRenderer {
  private pdfDoc: PDFDocumentProxy
  private scale: number
  private renderedPages: Set<number>
  private renderTasks: Map<number, PDFRenderTask>
  private pageRefs: Map<number, HTMLCanvasElement>
  private observerRef: IntersectionObserver | null = null
  private containerRef: HTMLDivElement | null = null
  private renderQueue: Set<number> = new Set()

  constructor(pdfDoc: PDFDocumentProxy, scale: number = 1.5) {
    this.pdfDoc = pdfDoc
    this.scale = scale
    this.renderedPages = new Set()
    this.renderTasks = new Map()
    this.pageRefs = new Map()
  }

  /**
   * 设置页面容器引用
   * @param container 容器元素
   */
  setContainer(container: HTMLDivElement): void {
    this.containerRef = container
  }

  /**
   * 设置页面canvas引用
   * @param pageNumber 页面号
   * @param canvas canvas元素
   */
  setPageRef(pageNumber: number, canvas: HTMLCanvasElement): void {
    this.pageRefs.set(pageNumber, canvas)
  }

  /**
   * 移除页面canvas引用
   * @param pageNumber 页面号
   */
  removePageRef(pageNumber: number): void {
    this.pageRefs.delete(pageNumber)
  }

  /**
   * 获取页面canvas引用
   * @param pageNumber 页面号
   */
  getPageRef(pageNumber: number): HTMLCanvasElement | undefined {
    return this.pageRefs.get(pageNumber)
  }

  /**
   * 渲染指定页面
   * @param pageNumber 页面号（1-based）
   * @returns Promise that resolves when rendering is complete
   */
  async renderPage(pageNumber: number): Promise<void> {
    if (this.renderedPages.has(pageNumber) || this.renderQueue.has(pageNumber)) {
      return
    }

    this.renderQueue.add(pageNumber)
    let page: PDFPageProxy | null = null

    try {
      const existingTask = this.renderTasks.get(pageNumber)
      if (existingTask) {
        await existingTask.cancel()
        this.renderTasks.delete(pageNumber)
      }

      page = await this.pdfDoc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: this.scale })

      const canvas = this.pageRefs.get(pageNumber)
      if (!canvas) {
        console.warn(`Canvas not found for page ${pageNumber}`)
        return
      }

      const context = canvas.getContext("2d")
      if (!context) {
        console.error(`Cannot get 2D context for page ${pageNumber}`)
        return
      }

      canvas.height = viewport.height
      canvas.width = viewport.width
      context.clearRect(0, 0, canvas.width, canvas.height)

      const renderTask = page.render({
        canvasContext: context,
        viewport: viewport,
      })

      this.renderTasks.set(pageNumber, renderTask)

      await renderTask.promise

      this.renderedPages.add(pageNumber)
      this.renderTasks.delete(pageNumber)
      
      console.log(`Page ${pageNumber} rendered successfully`)

    } catch (err: any) {
      if (err.name === "RenderingCancelledException") {
        console.log(`Rendering cancelled for page ${pageNumber}`)
      } else {
        console.error(`Error rendering page ${pageNumber}:`, err)
      }
      this.renderTasks.delete(pageNumber)
    } finally {
      this.renderQueue.delete(pageNumber)
      if (page) {
        page.cleanup()
      }
    }
  }

  /**
   * 更新缩放比例并重新渲染所有页面
   * @param newScale 新的缩放比例
   */
  async updateScale(newScale: number): Promise<void> {
    if (newScale === this.scale) {
      return
    }

    await Promise.all(
      Array.from(this.renderTasks.values()).map(task => task.cancel())
    )
    
    this.renderTasks.clear()
    this.renderedPages.clear()
    this.renderQueue.clear()
    
    this.scale = newScale

    setTimeout(() => {
      this.observeAllPages()
    }, 100)
  }

  /**
   * 设置懒加载观察器
   * @param options 观察器选项
   */
  setupLazyLoading(options?: IntersectionObserverInit): void {
    if (this.observerRef) {
      this.observerRef.disconnect()
    }

    this.observerRef = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNumber = Number.parseInt(
              entry.target.getAttribute("data-page") || "0"
            )
            if (pageNumber && !this.renderedPages.has(pageNumber)) {
              setTimeout(() => {
                if (!this.renderedPages.has(pageNumber)) {
                  this.renderPage(pageNumber)
                }
              }, 50)
            }
          }
        })
      },
      {
        root: this.containerRef,
        rootMargin: "100px",
        threshold: 0.1,
        ...options,
      }
    )

    this.observeAllPages()
  }

  /**
   * 观察所有页面元素
   * @private
   */
  private observeAllPages(): void {
    if (!this.observerRef) {
      return
    }

    const pageElements = document.querySelectorAll("[data-page]")
    pageElements.forEach((element) => {
      this.observerRef?.observe(element)
    })
  }

  /**
   * 观察单个页面元素
   * @param element 页面元素
   */
  observePage(element: HTMLElement): void {
    if (this.observerRef) {
      this.observerRef.observe(element)
    }
  }

  /**
   * 停止观察页面元素
   * @param element 页面元素
   */
  unobservePage(element: HTMLElement): void {
    if (this.observerRef) {
      this.observerRef.unobserve(element)
    }
  }

  /**
   * 预渲染指定范围的页面
   * @param startPage 起始页面（1-based）
   * @param endPage 结束页面（1-based）
   */
  async preRenderPages(startPage: number, endPage: number): Promise<void> {
    const promises: Promise<void>[] = []
    
    for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
      if (!this.renderedPages.has(pageNumber)) {
        promises.push(this.renderPage(pageNumber))
      }
    }

    await Promise.all(promises)
  }

  /**
   * 获取已渲染页面列表
   */
  getRenderedPages(): number[] {
    return Array.from(this.renderedPages).sort((a, b) => a - b)
  }

  /**
   * 获取正在渲染的页面列表
   */
  getRenderingPages(): number[] {
    return Array.from(this.renderTasks.keys()).sort((a, b) => a - b)
  }

  /**
   * 检查页面是否已渲染
   * @param pageNumber 页面号
   */
  isPageRendered(pageNumber: number): boolean {
    return this.renderedPages.has(pageNumber)
  }

  /**
   * 检查页面是否正在渲染
   * @param pageNumber 页面号
   */
  isPageRendering(pageNumber: number): boolean {
    return this.renderTasks.has(pageNumber)
  }

  /**
   * 取消页面渲染
   * @param pageNumber 页面号
   */
  cancelPageRender(pageNumber: number): void {
    const task = this.renderTasks.get(pageNumber)
    if (task) {
      task.cancel()
      this.renderTasks.delete(pageNumber)
    }
  }

  /**
   * 取消所有渲染任务
   */
  cancelAllRenders(): void {
    this.renderTasks.forEach((task) => {
      task.cancel()
    })
    this.renderTasks.clear()
  }

  /**
   * 获取当前缩放比例
   */
  getScale(): number {
    return this.scale
  }

  /**
   * 获取PDF文档总页数
   */
  getNumPages(): number {
    return this.pdfDoc?.numPages || 0
  }

  /**
   * 清理渲染器资源
   */
  cleanup(): void {
    this.renderTasks.forEach(task => task.cancel())
    this.renderTasks.clear()

    this.renderedPages.clear()
    this.renderQueue.clear()
    this.pageRefs.clear()

    if (this.observerRef) {
      this.observerRef.disconnect()
      this.observerRef = null
    }

    this.containerRef = null
    console.log("PDF renderer cleanup completed")
  }

  /**
   * 获取渲染统计信息
   */
  getRenderStats(): {
    totalPages: number
    renderedPages: number
    renderingPages: number
    scale: number
  } {
    return {
      totalPages: this.getNumPages(),
      renderedPages: this.renderedPages.size,
      renderingPages: this.renderTasks.size,
      scale: this.scale,
    }
  }
}

/**
 * 便利函数：创建PDF渲染器
 * @param pdfDoc PDF文档对象
 * @param scale 初始缩放比例
 * @returns PDF渲染器实例
 */
export function createPDFRenderer(
  pdfDoc: PDFDocumentProxy, 
  scale: number = 1.5
): PDFRenderer {
  return new PDFRenderer(pdfDoc, scale)
}

/**
 * 便利函数：渲染单页PDF
 * @param pdfDoc PDF文档对象
 * @param pageNumber 页面号
 * @param canvas 目标canvas
 * @param config 渲染配置
 */
export async function renderSinglePage(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  config: RenderConfig = { scale: 1.5 }
): Promise<void> {
  try {
    const page = await pdfDoc.getPage(pageNumber)
    const viewport = page.getViewport(config)
    const context = canvas.getContext("2d")

    if (!context) {
      throw new Error("Cannot get 2D rendering context")
    }

    canvas.height = viewport.height
    canvas.width = viewport.width

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    }

    const renderTask = page.render(renderContext)
    await renderTask.promise

  } catch (err) {
    console.error(`Error rendering page ${pageNumber}:`, err)
    throw err
  }
}

/**
 * 缩放控制工具类
 */
export class ScaleController {
  private minScale: number
  private maxScale: number
  private step: number
  private currentScale: number

  constructor(
    initialScale: number = 1.5,
    minScale: number = 0.5,
    maxScale: number = 3.0,
    step: number = 0.25
  ) {
    this.currentScale = initialScale
    this.minScale = minScale
    this.maxScale = maxScale
    this.step = step
  }

  /**
   * 放大
   */
  zoomIn(): number {
    this.currentScale = Math.min(this.currentScale + this.step, this.maxScale)
    return this.currentScale
  }

  /**
   * 缩小
   */
  zoomOut(): number {
    this.currentScale = Math.max(this.currentScale - this.step, this.minScale)
    return this.currentScale
  }

  /**
   * 设置缩放比例
   * @param scale 新的缩放比例
   */
  setScale(scale: number): number {
    this.currentScale = Math.max(
      this.minScale,
      Math.min(scale, this.maxScale)
    )
    return this.currentScale
  }

  /**
   * 获取当前缩放比例
   */
  getScale(): number {
    return this.currentScale
  }

  /**
   * 获取缩放百分比
   */
  getScalePercent(): number {
    return Math.round(this.currentScale * 100)
  }

  /**
   * 重置为默认缩放
   */
  reset(): number {
    this.currentScale = 1.0
    return this.currentScale
  }

  /**
   * 检查是否可以放大
   */
  canZoomIn(): boolean {
    return this.currentScale < this.maxScale
  }

  /**
   * 检查是否可以缩小
   */
  canZoomOut(): boolean {
    return this.currentScale > this.minScale
  }
}
