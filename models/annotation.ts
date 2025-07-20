// 从 types/pdf-annotation.ts 复制过来，保持一致
export interface AnnotationReply {
  id: string
  author: {
    name: string
    role: string
    avatar?: string
    color: string
  }
  content: string
  timestamp: string
  isEditing?: boolean
}


// 前端传入的批注结构
export interface FrontendAnnotation {
  id: string;
  pageIndex: number;
  content: string;
  type: "highlight" | "note" | "strikeout";
  author: {
    name: string;
    role: string;
  };
  timestamp: string;
  coordinates: {
    pdfCoordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  aiAnnotation?: {
    selectedText: string;
    originalData?: any;
  };
  // 新增 replies 字段以接收回复
  replies?: AnnotationReply[];
}

// 后端pdf-lib生成时使用的批注结构
export interface BackendAnnotation {
  id: string
  page: number
  author: string
  content: string
  timestamp: string | Date
  x: number
  y: number
  width: number
  height: number
  selectedText: string
  type: "highlight" | "note" | "strikeout"
  // 新增字段以支持回复功能
  isReply?: boolean
  inReplyTo?: string
} 