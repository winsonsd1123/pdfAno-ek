import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFHexString, PDFNumber, PDFRef, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path'
import { head } from '@vercel/blob'

// 从 types/pdf-annotation.ts 复制过来，保持一致
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
  isEditing?: boolean
}


// 前端传入的批注结构
interface FrontendAnnotation {
  id: string;
  pageIndex: number;
  content: string;
  type: "highlight" | "note";
  author: {
    name: string;
    role: "AI助手" | "手动批注者" | "导师" | "同学";
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
  };
  // 新增 replies 字段以接收回复
  replies?: AnnotationReply[];
}

// 后端pdf-lib生成时使用的批注结构
interface BackendAnnotation {
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

// 数据转换函数 - 彻底重构以支持真正的回复链
function transformAnnotations(frontendAnnotations: FrontendAnnotation[]): BackendAnnotation[] {
  const backendAnnotations: BackendAnnotation[] = [];

  frontendAnnotations.forEach(anno => {
    // 计算坐标 - 使用 author.role 来判断是否是AI标注
    const isAIAnnotation = anno.author.role === "AI助手";
    const y = isAIAnnotation
      ? anno.coordinates.pdfCoordinates.y - anno.coordinates.pdfCoordinates.height
      : anno.coordinates.pdfCoordinates.y;

    // 1. 添加主批注
    backendAnnotations.push({
      id: anno.id,
      page: anno.pageIndex + 1,
      author: anno.author.name,
      content: anno.content,
      timestamp: anno.timestamp,
      x: anno.coordinates.pdfCoordinates.x,
      y: y,
      width: anno.coordinates.pdfCoordinates.width,
      height: anno.coordinates.pdfCoordinates.height,
      selectedText: anno.aiAnnotation?.selectedText || '',
      type: anno.type,
      isReply: false,
    });

    // 2. 如果有回复，则扁平化处理
    if (anno.replies && anno.replies.length > 0) {
      anno.replies.forEach(reply => {
        backendAnnotations.push({
          id: reply.id,
          page: anno.pageIndex + 1, // 回复在同一页
          author: reply.author.name,
          content: reply.content,
          timestamp: reply.timestamp,
          // 将回复图标定位在父批注的右上角
          x: anno.coordinates.pdfCoordinates.x + anno.coordinates.pdfCoordinates.width,
          y: anno.coordinates.pdfCoordinates.y + anno.coordinates.pdfCoordinates.height,
          width: 24, // Note图标的标准尺寸
          height: 24,
          selectedText: '',
          type: 'note', // 所有回复都作为Note类型
          isReply: true,
          inReplyTo: anno.id, // 指向父批注
        });
      });
    }
  });

  return backendAnnotations;
}


// 创建PDF注释的工具函数
function createPDFAnnotation(
  pdfDoc: PDFDocument,
  page: any,
  annotation: BackendAnnotation,
  pdfY: number,
  parentRef?: PDFRef
): any {
  const timestamp = new Date(annotation.timestamp).toISOString().replace(/[-:T]/g, '').substring(0, 14) + 'Z'
  
  // 为了在PDF的富文本（RC）弹窗中正确显示换行，需要将换行符 \n 替换为 <br/>
  const richTextContent = (annotation.content || '').replace(/\n/g, '<br/>');

  switch (annotation.type) {
    case 'highlight':
      return pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Highlight',
        Rect: [annotation.x, pdfY, annotation.x + annotation.width, pdfY + annotation.height],
        Contents: PDFHexString.fromText(annotation.content || ''),
        T: PDFHexString.fromText(annotation.author || ''),
        M: `D:${timestamp}`,
        C: [1, 1, 0], // 黄色
        CA: 0.5,
        QuadPoints: [
          annotation.x, pdfY + annotation.height,
          annotation.x + annotation.width, pdfY + annotation.height,
          annotation.x, pdfY,
          annotation.x + annotation.width, pdfY
        ],
        F: 4,
        P: page.ref,
        // 添加自定义属性以支持更好的显示
        RC: PDFHexString.fromText(`<?xml version="1.0"?><body xmlns="http://www.w3.org/1999/xhtml" xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><p>${richTextContent}</p></body>`),
        Subj: PDFHexString.fromText('高亮'),
      })

    /*
    case 'comment':
      // 创建带背景色的高亮注释（浅蓝色背景，包含完整注释信息）
      return pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Highlight',
        Rect: [annotation.x, pdfY, annotation.x + annotation.width, pdfY + annotation.height],
        Contents: PDFHexString.fromText(annotation.content || ''),
        T: PDFHexString.fromText(annotation.author || ''),
        M: `D:${timestamp}`,
        C: [0.8, 0.9, 1], // 浅蓝色背景
        CA: 0.3, // 较低的透明度，让文字更明显
        QuadPoints: [
          annotation.x, pdfY + annotation.height,
          annotation.x + annotation.width, pdfY + annotation.height,
          annotation.x, pdfY,
          annotation.x + annotation.width, pdfY
        ],
        F: 4,
        P: page.ref,
        Subj: PDFHexString.fromText('评论'),
        RC: PDFHexString.fromText(`<?xml version="1.0"?><body xmlns="http://www.w3.org/1999/xhtml" xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><p>${annotation.content}</p></body>`),
      })
    */

    case 'note':
      const noteObject: any = {
        Type: 'Annot',
        Subtype: 'Text',
        Rect: [annotation.x, pdfY, annotation.x + 24, pdfY + 24],
        Contents: PDFHexString.fromText(annotation.content || ''),
        T: PDFHexString.fromText(annotation.author || ''),
        M: `D:${timestamp}`,
        Name: 'Note',
        Open: false,
        F: 4,
        C: [1, 0.8, 0],
        P: page.ref,
        Subj: PDFHexString.fromText(annotation.isReply ? '回复' : '便笺'),
        RC: PDFHexString.fromText(`<?xml version="1.0"?><body xmlns="http://www.w3.org/1999/xhtml" xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><p>${richTextContent}</p></body>`),
      }
      
      // 如果是回复，则添加关联字段
      if (parentRef && annotation.isReply) {
        noteObject.IRT = parentRef; // In-Reply-To
        noteObject.RT = PDFName.of('Reply');   // Reply-Type
        noteObject.Name = 'Comment'; // 许多阅读器将带有IRT的Text注释视为"Comment"
      }
      
      return pdfDoc.context.obj(noteObject)

    case 'strikeout':
      return pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'StrikeOut',
        Rect: [annotation.x, pdfY, annotation.x + annotation.width, pdfY + annotation.height],
        Contents: PDFHexString.fromText(annotation.content || ''),
        T: PDFHexString.fromText(annotation.author || ''),
        M: `D:${timestamp}`,
        C: [1, 0, 0], // 红色
        QuadPoints: [
          annotation.x, pdfY + annotation.height,
          annotation.x + annotation.width, pdfY + annotation.height,
          annotation.x, pdfY,
          annotation.x + annotation.width, pdfY
        ],
        F: 4,
        P: page.ref,
        Subj: PDFHexString.fromText('删除线'),
      })

    default:
      return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { filename, annotations: frontendAnnotations } = await request.json()
    
    if (!filename || !frontendAnnotations) {
      return NextResponse.json({ error: 'Missing filename or annotations' }, { status: 400 })
    }

    // 执行数据转换
    const annotations = transformAnnotations(frontendAnnotations)

    // 读取原始PDF文件
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'Blob存储未配置' }, { status: 500 })
    }

    let existingPdfBytes: ArrayBuffer
    try {
      // 从blob存储获取文件信息
      const blob = await head(filename, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })

      // 获取文件内容
      const response = await fetch(blob.url)
      if (!response.ok) {
        throw new Error('Failed to fetch PDF from blob storage')
      }
      existingPdfBytes = await response.arrayBuffer()
    } catch (blobError) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    // 加载PDF文档
    const pdfDoc = await PDFDocument.load(existingPdfBytes)
    const pages = pdfDoc.getPages()
    
    // 注册 fontkit
    pdfDoc.registerFontkit(fontkit)

    // 嵌入中文字体
    const fontFileBytes = fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'SourceHanSansCN-Regular.otf'))
    const font = await pdfDoc.embedFont(Uint8Array.from(fontFileBytes).buffer)
    
    // 按页面分组注释
    const annotationsByPage = annotations.reduce((acc: any, annotation: any) => {
      if (!acc[annotation.page]) {
        acc[annotation.page] = []
      }
      acc[annotation.page].push(annotation)
      return acc
    }, {})
    
    // 为每个页面添加注释
    Object.keys(annotationsByPage).forEach((pageNum) => {
      const pageIndex = parseInt(pageNum) - 1
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex]
        const pageAnnotations = annotationsByPage[pageNum] as BackendAnnotation[]
        
        // 安全地获取或创建页面注释数组
        let pageAnnots = page.node.get(PDFName.of('Annots')) as PDFArray
        if (!pageAnnots || !(pageAnnots instanceof PDFArray)) {
          pageAnnots = PDFArray.withContext(pdfDoc.context)
          page.node.set(PDFName.of('Annots'), pageAnnots)
        }

        // 两遍渲染法：先渲染主批注，再渲染回复
        const refMap = new Map<string, PDFRef>();
        const mainAnnotations = pageAnnotations.filter(a => !a.isReply);
        const replyAnnotations = pageAnnotations.filter(a => a.isReply);

        // 第一遍：创建所有主批注并记录其引用
        mainAnnotations.forEach(annotation => {
          const pdfY = annotation.y;
          const annotationObj = createPDFAnnotation(pdfDoc, page, annotation, pdfY);
          if (annotationObj) {
            const ref = pdfDoc.context.register(annotationObj);
            refMap.set(annotation.id, ref);
            pageAnnots.push(ref);
          }
        });

        // 第二遍：创建所有回复批注，并链接到父批注
        replyAnnotations.forEach(annotation => {
          if (annotation.inReplyTo) {
            const parentRef = refMap.get(annotation.inReplyTo);
            if (parentRef) {
              const pdfY = annotation.y;
              const annotationObj = createPDFAnnotation(pdfDoc, page, annotation, pdfY, parentRef);
              if (annotationObj) {
                pageAnnots.push(annotationObj);
              }
            }
          }
        });
      }
    })
    
    // 添加文档级别的元数据
    pdfDoc.setTitle(`${filename} - 带注释版本`)
    pdfDoc.setSubject('包含用户注释的PDF文档')
    pdfDoc.setKeywords(['注释', '批注', 'PDF', '中文'])
    pdfDoc.setProducer('PDF注释导出工具')
    pdfDoc.setCreator('NextJS PDF Annotation System')
    pdfDoc.setCreationDate(new Date())
    pdfDoc.setModificationDate(new Date())
    
    // 生成导出的PDF
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: false, // 确保注释兼容性
      addDefaultPage: false,
    })
    
    // 生成统一格式的导出文件名
    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const exportFilename = `export_${timestamp}.pdf`;
    
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportFilename}"`,
        'X-Annotation-Count': annotations.length.toString(),
      },
    })

  } catch (error) {
    console.error('Enhanced export error:', error)
    return NextResponse.json({ 
      error: 'Failed to export enhanced PDF', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
