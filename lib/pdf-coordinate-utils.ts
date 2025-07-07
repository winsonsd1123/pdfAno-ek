import type { 
  PDFDocumentProxy, 
  CoordinateInfo, 
  Annotation 
} from './pdf-types'

/**
 * 从canvas点击事件创建完整的coordinates对象
 * @param event 鼠标点击事件
 * @param pageIndex 页面索引
 * @param pdfDoc PDF文档对象
 * @param scale 当前缩放比例
 * @param width 注释宽度（默认200）
 * @param height 注释高度（默认100）
 * @returns 坐标信息对象或null
 */
export async function createCoordinatesFromClick(
  event: React.MouseEvent<HTMLCanvasElement>, 
  pageIndex: number,
  pdfDoc: PDFDocumentProxy,
  scale: number,
  width: number = 200,
  height: number = 100
): Promise<CoordinateInfo | null> {
  if (!pdfDoc) return null

  const canvas = event.currentTarget
  const rect = canvas.getBoundingClientRect()

  // 计算canvas坐标
  const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width)
  const canvasY = (event.clientY - rect.top) * (canvas.height / rect.height)

  try {
    const page = await pdfDoc.getPage(pageIndex + 1)
    const viewport = page.getViewport({ scale: 1 }) // 使用scale=1获取原始坐标
    const currentViewport = page.getViewport({ scale }) // 当前缩放级别的视口

    // 转换到原始坐标系统
    const normalizedX = (canvasX / currentViewport.width) * viewport.width
    const normalizedY = (canvasY / currentViewport.height) * viewport.height

    // 视口坐标 (左上角为原点)
    const viewportX = normalizedX
    const viewportY = normalizedY

    // PDF坐标 (左下角为原点)
    const pdfX = normalizedX
    const pdfY = viewport.height - normalizedY

    return {
      pdfCoordinates: {
        x: pdfX,
        y: pdfY,
        width: width,
        height: height,
      },
      viewportCoordinates: {
        x: viewportX,
        y: viewportY,
        width: width,
        height: height,
      },
      pageSize: {
        width: viewport.width,
        height: viewport.height,
      },
    }
  } catch (err) {
    console.error("Error creating coordinates from click:", err)
    return null
  }
}

/**
 * 从旧格式标注创建coordinates（用于向后兼容）
 * @param annotation 包含旧格式坐标的标注对象
 * @param pdfDoc PDF文档对象
 * @returns 坐标信息对象或null
 */
export async function createCoordinatesFromLegacy(
  annotation: { x: number, y: number, width: number, height: number, pageIndex: number },
  pdfDoc: PDFDocumentProxy
): Promise<CoordinateInfo | null> {
  if (!pdfDoc) return null

  try {
    const page = await pdfDoc.getPage(annotation.pageIndex + 1)
    const viewport = page.getViewport({ scale: 1 })

    // 假设旧的坐标是基于当前缩放级别的canvas坐标
    // 转换回原始坐标系统
    const normalizedX = annotation.x
    const normalizedY = annotation.y

    return {
      pdfCoordinates: {
        x: normalizedX,
        y: viewport.height - normalizedY,
        width: annotation.width,
        height: annotation.height,
      },
      viewportCoordinates: {
        x: normalizedX,
        y: normalizedY,
        width: annotation.width,
        height: annotation.height,
      },
      pageSize: {
        width: viewport.width,
        height: viewport.height,
      },
    }
  } catch (err) {
    console.error("Error creating coordinates from legacy:", err)
    return null
  }
}

/**
 * 统一的显示坐标计算函数
 * @param coordinates 坐标信息对象
 * @param canvas 画布元素
 * @param scale 当前缩放比例
 * @returns 显示位置样式对象
 */
export function calculateDisplayPosition(
  coordinates: CoordinateInfo, 
  canvas: HTMLCanvasElement,
  scale: number
): {
  left: string
  top: string
  width: string
  height: string
} {
  const currentViewport = { width: canvas.width, height: canvas.height }
  const scaleRatio = scale / 1 // 从scale=1转换到当前scale
  
  const highlightX = coordinates.viewportCoordinates.x * scaleRatio
  const highlightY = coordinates.viewportCoordinates.y * scaleRatio
  const highlightWidth = coordinates.viewportCoordinates.width * scaleRatio
  const highlightHeight = coordinates.viewportCoordinates.height * scaleRatio * 1.2

  return {
    left: `${(highlightX / currentViewport.width) * 100}%`,
    top: `${(highlightY / currentViewport.height) * 100}%`,
    width: `${(highlightWidth / currentViewport.width) * 100}%`,
    height: `${(highlightHeight / currentViewport.height) * 100}%`,
  }
}

/**
 * 从PDF坐标转换为视口坐标
 * @param pdfCoords PDF坐标系统中的坐标
 * @param pageSize 页面尺寸
 * @returns 视口坐标系统中的坐标
 */
export function pdfToViewportCoordinates(
  pdfCoords: { x: number; y: number; width: number; height: number },
  pageSize: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  return {
    x: pdfCoords.x,
    y: pageSize.height - pdfCoords.y, // PDF坐标系是左下角为原点，视口坐标系是左上角为原点
    width: pdfCoords.width,
    height: pdfCoords.height
  }
}

/**
 * 从视口坐标转换为PDF坐标
 * @param viewportCoords 视口坐标系统中的坐标
 * @param pageSize 页面尺寸
 * @returns PDF坐标系统中的坐标
 */
export function viewportToPdfCoordinates(
  viewportCoords: { x: number; y: number; width: number; height: number },
  pageSize: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  return {
    x: viewportCoords.x,
    y: pageSize.height - viewportCoords.y, // 视口坐标系是左上角为原点，PDF坐标系是左下角为原点
    width: viewportCoords.width,
    height: viewportCoords.height
  }
}

/**
 * 计算相对位置百分比
 * @param coordinates 绝对坐标
 * @param pageSize 页面尺寸
 * @returns 相对位置百分比
 */
export function calculateRelativePosition(
  coordinates: { x: number; y: number },
  pageSize: { width: number; height: number }
): { xPercent: number; yPercent: number } {
  return {
    xPercent: Math.round((coordinates.x / pageSize.width) * 10000) / 100,
    yPercent: Math.round((coordinates.y / pageSize.height) * 10000) / 100
  }
}

/**
 * 验证坐标信息是否有效
 * @param coordinates 坐标信息对象
 * @returns 是否有效
 */
export function validateCoordinates(coordinates: CoordinateInfo): boolean {
  const { pdfCoordinates, viewportCoordinates, pageSize } = coordinates
  
  // 检查坐标值是否为有效数字
  const isValidNumber = (num: number): boolean => 
    typeof num === 'number' && !isNaN(num) && isFinite(num)
  
  const isPdfValid = 
    isValidNumber(pdfCoordinates.x) &&
    isValidNumber(pdfCoordinates.y) &&
    isValidNumber(pdfCoordinates.width) &&
    isValidNumber(pdfCoordinates.height)
  
  const isViewportValid = 
    isValidNumber(viewportCoordinates.x) &&
    isValidNumber(viewportCoordinates.y) &&
    isValidNumber(viewportCoordinates.width) &&
    isValidNumber(viewportCoordinates.height)
  
  const isPageSizeValid = 
    isValidNumber(pageSize.width) &&
    isValidNumber(pageSize.height) &&
    pageSize.width > 0 &&
    pageSize.height > 0
  
  return isPdfValid && isViewportValid && isPageSizeValid
}

/**
 * 创建默认坐标信息（用作后备）
 * @param pageIndex 页面索引
 * @param x 默认x坐标
 * @param y 默认y坐标
 * @param width 默认宽度
 * @param height 默认高度
 * @returns 默认坐标信息对象
 */
export function createDefaultCoordinates(
  pageIndex: number,
  x: number = 50,
  y: number = 50,
  width: number = 100,
  height: number = 20
): CoordinateInfo {
  // 使用标准页面尺寸作为默认值
  const defaultPageSize = { width: 612, height: 792 } // A4 页面尺寸（72 DPI）
  
  return {
    pdfCoordinates: {
      x: x,
      y: defaultPageSize.height - y, // 转换为PDF坐标系
      width: width,
      height: height
    },
    viewportCoordinates: {
      x: x,
      y: y,
      width: width,
      height: height
    },
    pageSize: defaultPageSize
  }
} 