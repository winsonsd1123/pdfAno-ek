export type PDFDocumentProxy = any
export type PDFPageProxy = any  
export type PDFPageViewport = any
export type PDFRenderTask = any
export type SearchResult = any

// 应用特定的接口定义（业务逻辑相关）

export interface AnnotationReply {
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

export interface Annotation {
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

export interface DebugInfo {
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
} 