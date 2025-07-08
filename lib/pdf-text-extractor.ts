import type { 
  PDFDocumentProxy, 
  PDFPageViewport,
  TextItem, 
  SearchResult, 
  SearchOptions,
  TextMatchResult
} from './pdf-types'
import { calculateRelativePosition } from './pdf-coordinate-utils'

/**
 * PDF文本提取器类
 * 负责PDF文本的提取、搜索和智能匹配
 */
export class PDFTextExtractor {
  private pdfDoc: PDFDocumentProxy

  constructor(pdfDoc: PDFDocumentProxy) {
    this.pdfDoc = pdfDoc
  }

  /**
   * 提取PDF全文内容
   * @returns 包含所有页面文本的字符串
   */
  async extractFullText(): Promise<string> {
    let fullText = ""

    try {
      for (let pageIndex = 1; pageIndex <= this.pdfDoc.numPages; pageIndex++) {
        const page = await this.pdfDoc.getPage(pageIndex)
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
  }

  /**
   * 文本标准化函数 - 处理标点符号和空格问题
   * @param text 需要标准化的文本
   * @returns 标准化后的文本
   */
  private normalizeText(text: string): string {
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
  }

  /**
   * 智能文本匹配函数
   * @param searchText 搜索文本
   * @param targetText 目标文本
   * @returns 匹配结果对象
   */
  private smartTextMatch(searchText: string, targetText: string): TextMatchResult {
    const normalizedSearch = this.normalizeText(searchText.toLowerCase())
    const normalizedTarget = this.normalizeText(targetText.toLowerCase())
    
    // 1. 直接匹配
    if (normalizedTarget.includes(normalizedSearch)) {
      return { found: true, strategy: 'direct', confidence: 1.0 }
    }
    
    // 2. 移除所有标点符号和空格的匹配
    const cleanSearch = normalizedSearch.replace(/[^\w\u4e00-\u9fff]/g, '')
    const cleanTarget = normalizedTarget.replace(/[^\w\u4e00-\u9fff]/g, '')
    
    if (cleanTarget.includes(cleanSearch)) {
      return { found: true, strategy: 'clean', confidence: 0.9 }
    }
    
    // 3. 更激进的文本清理：只保留中文字符和字母数字
    const veryCleanSearch = normalizedSearch.replace(/[^\u4e00-\u9fff\w]/g, '')
    const veryCleanTarget = normalizedTarget.replace(/[^\u4e00-\u9fff\w]/g, '')
    
    if (veryCleanTarget.includes(veryCleanSearch)) {
      return { found: true, strategy: 'very_clean', confidence: 0.8 }
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
      const matchRatio = foundWords.length / searchWords.length
      if (matchRatio >= 0.8) {
        return { found: true, strategy: 'word_match', confidence: matchRatio * 0.7 }
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
      const sequenceRatio = searchIndex / cleanSearch.length
      if (sequenceRatio >= 0.85) {
        return { found: true, strategy: 'sequence_match', confidence: sequenceRatio * 0.6 }
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
        return { found: true, strategy: 'number_chinese', confidence: 0.75 }
      }
    }
    
    return { found: false, strategy: 'direct', confidence: 0.0 }
  }

  /**
   * 创建搜索结果的辅助函数
   * @param item 文本项
   * @param pageIndex 页面索引
   * @param textIndex 文本索引
   * @param paragraphIndex 段落索引
   * @param paragraph 段落文本项数组
   * @param viewport 页面视口
   * @param customText 自定义文本（可选）
   * @returns 搜索结果对象
   */
  private createSearchResult(
    item: TextItem,
    pageIndex: number,
    textIndex: number,
    paragraphIndex: number,
    paragraph: TextItem[],
    viewport: PDFPageViewport,
    customText?: string
  ): SearchResult {
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
    const relativePosition = calculateRelativePosition({ x: pdfX, y: viewportY }, viewport)

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
        relativePosition: relativePosition,
      },
    }
  }

  /**
   * 搜索文本功能
   * @param options 搜索选项
   * @returns 搜索结果数组或单个结果
   */
  async searchText(options: SearchOptions): Promise<SearchResult[] | SearchResult | null> {
    const { query, targetPage, returnFirst = false } = options
    
    if (!query?.trim()) {
      return returnFirst ? null : []
    }

    const results: SearchResult[] = []
    const lowerQuery = query.toLowerCase()

    try {
      const startPage = targetPage || 1
      const endPage = targetPage || this.pdfDoc.numPages

      for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
        const page = await this.pdfDoc.getPage(pageIndex)
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
            const matchResult = this.smartTextMatch(query, item.str)
            if (matchResult.found) {
              console.log(`✅ 智能单项匹配成功: "${item.str}" 匹配查询 "${query}" (策略: ${matchResult.strategy}, 置信度: ${matchResult.confidence})`)
              const result = this.createSearchResult(item, pageIndex, textIndex, paragraphIndex, paragraph, viewport)
              results.push(result)
              
              if (returnFirst) {
                return // 注意：这里return只是退出forEach，不是退出函数
              }
            }
            // 传统匹配作为后备
            else if (item.str.toLowerCase().includes(lowerQuery)) {
              const result = this.createSearchResult(item, pageIndex, textIndex, paragraphIndex, paragraph, viewport)
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
            
            const paragraphMatchResult = this.smartTextMatch(query, paragraphText)
            const paragraphSpaceMatchResult = this.smartTextMatch(query, paragraphTextWithSpaces)
            
            if (paragraphMatchResult.found || paragraphSpaceMatchResult.found) {
              const bestMatch = paragraphMatchResult.confidence > paragraphSpaceMatchResult.confidence 
                ? paragraphMatchResult : paragraphSpaceMatchResult
              
              console.log(`✅ 智能段落匹配成功在页面 ${pageIndex} 段落 ${paragraphIndex + 1} (策略: ${bestMatch.strategy}, 置信度: ${bestMatch.confidence})`)
              console.log(`   查询: "${query}"`)
              console.log(`   匹配: "${paragraphText.substring(0, 100)}${paragraphText.length > 100 ? '...' : ''}"`)
              
              // 使用段落中间的项作为定位点
              const middleIndex = Math.floor(paragraph.length / 2)
              const item = paragraph[middleIndex] || paragraph[0]
              const result = this.createSearchResult(item, pageIndex, middleIndex, paragraphIndex, paragraph, viewport, query)
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
          } as any
        }
      }

      return returnFirst ? null : results
    } catch (err) {
      console.error("Error searching text:", err)
      return returnFirst ? null : []
    }
  }
}

/**
 * 便利函数：创建文本提取器实例
 * @param pdfDoc PDF文档对象
 * @returns 文本提取器实例
 */
export function createTextExtractor(pdfDoc: PDFDocumentProxy): PDFTextExtractor {
  return new PDFTextExtractor(pdfDoc)
}

/**
 * 便利函数：提取PDF全文
 * @param pdfDoc PDF文档对象
 * @returns PDF全文内容
 */
export async function extractPDFText(pdfDoc: PDFDocumentProxy): Promise<string> {
  const extractor = new PDFTextExtractor(pdfDoc)
  return extractor.extractFullText()
}

/**
 * 便利函数：搜索PDF文本
 * @param pdfDoc PDF文档对象
 * @param query 搜索查询
 * @param options 搜索选项
 * @returns 搜索结果
 */
export async function searchPDFText(
  pdfDoc: PDFDocumentProxy, 
  query: string, 
  options?: Partial<SearchOptions>
): Promise<SearchResult[]> {
  const extractor = new PDFTextExtractor(pdfDoc)
  const searchOptions: SearchOptions = { query, ...options }
  const results = await extractor.searchText(searchOptions)
  return Array.isArray(results) ? results : []
}
