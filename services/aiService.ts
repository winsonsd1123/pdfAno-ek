import { type NextRequest } from "next/server"

/**
 * AI 服务层
 * 负责处理 AI 相关的业务逻辑，但不涉及 HTTP 层面的处理
 */
export class AiService {
  private readonly defaultModel: string
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || ''
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
    this.defaultModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

    if (!this.apiKey) {
      throw new Error("DeepSeek API key not configured")
    }
  }

  /**
   * 构建批注提示词
   */
  private buildPrompt(text: string): string {
    return `你是一位有着20年教学科研经验的资深本科论文指导教师，请以严谨而耐心的态度对这篇本科生论文进行详细批注。

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

${text}`
  }

  /**
   * 调用 AI 服务生成批注
   */
  async analyze(text: string) {
    if (!text?.trim()) {
      throw new Error("文本内容不能为空")
    }

    const prompt = this.buildPrompt(text)
    const endpoint = `${this.baseUrl}/chat/completions`

    const requestBody = {
      model: this.defaultModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
      stream: false,
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        "User-Agent": "PDF-Annotator/1.0",
      },
      body: JSON.stringify(requestBody),
    })

    const responseData = await response.json()

    if (!response.ok) {
      const errorDetails = responseData.error ? responseData.error.message : "Unknown API error"
      throw new Error(`Failed to connect to DeepSeek API: ${errorDetails}`)
    }
    
    if (responseData.choices?.[0]?.message) {
      return {
        content: responseData.choices[0].message.content,
        usage: responseData.usage,
      }
    }
    
    throw new Error("Invalid response structure from DeepSeek API")
  }
} 