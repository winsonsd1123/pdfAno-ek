import { PDFDocument, PDFName, PDFDict, PDFArray, PDFHexString, PDFRef } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path'
import { BackendAnnotation, FrontendAnnotation } from '@/models/annotation'

// 数据转换函数 - 从旧 route 文件迁移
function transformAnnotations(frontendAnnotations: FrontendAnnotation[]): BackendAnnotation[] {
    const backendAnnotations: BackendAnnotation[] = [];

    frontendAnnotations.forEach(anno => {
        const isAIAnnotation = anno.author.role === "AI助手";
        const y = isAIAnnotation
            ? anno.coordinates.pdfCoordinates.y - anno.coordinates.pdfCoordinates.height
            : anno.coordinates.pdfCoordinates.y;

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

        if (anno.replies && anno.replies.length > 0) {
            anno.replies.forEach(reply => {
                backendAnnotations.push({
                    id: reply.id,
                    page: anno.pageIndex + 1,
                    author: reply.author.name,
                    content: reply.content,
                    timestamp: reply.timestamp,
                    x: anno.coordinates.pdfCoordinates.x + anno.coordinates.pdfCoordinates.width,
                    y: anno.coordinates.pdfCoordinates.y + anno.coordinates.pdfCoordinates.height,
                    width: 24,
                    height: 24,
                    selectedText: '',
                    type: 'note',
                    isReply: true,
                    inReplyTo: anno.id,
                });
            });
        }
    });

    return backendAnnotations;
}

// 创建PDF注释的工具函数 - 从旧 route 文件迁移
function createPDFAnnotation(
    pdfDoc: PDFDocument,
    page: any,
    annotation: BackendAnnotation,
    pdfY: number,
    parentRef?: PDFRef
): any {
    const timestamp = new Date(annotation.timestamp).toISOString().replace(/[-:T]/g, '').substring(0, 14) + 'Z'
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
                C: [1, 1, 0], // Yellow
                CA: 0.5,
                QuadPoints: [
                    annotation.x, pdfY + annotation.height,
                    annotation.x + annotation.width, pdfY + annotation.height,
                    annotation.x, pdfY,
                    annotation.x + annotation.width, pdfY
                ],
                F: 4,
                P: page.ref,
                RC: PDFHexString.fromText(`<?xml version="1.0"?><body xmlns="http://www.w3.org/1999/xhtml" xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><p>${richTextContent}</p></body>`),
                Subj: PDFHexString.fromText('高亮'),
            });
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
            };
            if (parentRef && annotation.isReply) {
                noteObject.IRT = parentRef;
                noteObject.RT = PDFName.of('Reply');
                noteObject.Name = 'Comment';
            }
            return pdfDoc.context.obj(noteObject);
        case 'strikeout':
            return pdfDoc.context.obj({
                Type: 'Annot',
                Subtype: 'StrikeOut',
                Rect: [annotation.x, pdfY, annotation.x + annotation.width, pdfY + annotation.height],
                Contents: PDFHexString.fromText(annotation.content || ''),
                T: PDFHexString.fromText(annotation.author || ''),
                M: `D:${timestamp}`,
                C: [1, 0, 0], // Red
                QuadPoints: [
                    annotation.x, pdfY + annotation.height,
                    annotation.x + annotation.width, pdfY + annotation.height,
                    annotation.x, pdfY,
                    annotation.x + annotation.width, pdfY
                ],
                F: 4,
                P: page.ref,
                Subj: PDFHexString.fromText('删除线'),
            });
        default:
            return null;
    }
}

// 主函数
export async function embedAnnotations(
    existingPdfBytes: ArrayBuffer,
    frontendAnnotations: FrontendAnnotation[]
): Promise<Uint8Array> {
    const annotations = transformAnnotations(frontendAnnotations);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();

    pdfDoc.registerFontkit(fontkit);
    const fontFileBytes = fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'SourceHanSansCN-Regular.otf'));
    await pdfDoc.embedFont(Uint8Array.from(fontFileBytes).buffer);

    const annotationsByPage = annotations.reduce((acc: any, annotation: any) => {
        if (!acc[annotation.page]) {
            acc[annotation.page] = [];
        }
        acc[annotation.page].push(annotation);
        return acc;
    }, {});

    Object.keys(annotationsByPage).forEach((pageNum) => {
        const pageIndex = parseInt(pageNum) - 1;
        if (pageIndex >= 0 && pageIndex < pages.length) {
            const page = pages[pageIndex];
            const pageAnnotations = annotationsByPage[pageNum] as BackendAnnotation[];
            
            let pageAnnots = page.node.get(PDFName.of('Annots')) as PDFArray;
            if (!pageAnnots || !(pageAnnots instanceof PDFArray)) {
                pageAnnots = PDFArray.withContext(pdfDoc.context);
                page.node.set(PDFName.of('Annots'), pageAnnots);
            }

            const refMap = new Map<string, PDFRef>();
            const mainAnnotations = pageAnnotations.filter(a => !a.isReply);
            const replyAnnotations = pageAnnotations.filter(a => a.isReply);

            mainAnnotations.forEach(annotation => {
                const pdfY = annotation.y;
                const annotationObj = createPDFAnnotation(pdfDoc, page, annotation, pdfY);
                if (annotationObj) {
                    const ref = pdfDoc.context.register(annotationObj);
                    refMap.set(annotation.id, ref);
                    pageAnnots.push(ref);
                }
            });

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
    });

    pdfDoc.setTitle('带注释版本');
    pdfDoc.setSubject('包含用户注释的PDF文档');
    pdfDoc.setKeywords(['注释', '批注', 'PDF', '中文']);
    pdfDoc.setProducer('PDF注释导出工具');
    pdfDoc.setCreator('NextJS PDF Annotation System');
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    return await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
    });
} 