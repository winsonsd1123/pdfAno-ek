import type { AIServiceResponse, AIAnnotationConfig, AIAnnotationError } from './pdf-types'

/**
 * AI批注API调用服务
 * 
 * 封装DeepSeek API调用逻辑，提供统一的错误处理和重试机制
 * 参考PDF加载器的设计模式，确保稳定性和可维护性
 */

// 默认配置
const DEFAULT_CONFIG: AIAnnotationConfig = {
  model: "deepseek-chat",
  prompt: "",
  maxRetries: 3,
  timeout: 90000 // 90秒超时
}

/**
 * 构建AI批注的Prompt
 * @param pdfText - PDF文本内容
 * @returns 构建好的prompt
 */
export function buildAnnotationPrompt(pdfText: string): string {
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

${pdfText}`
}

/**
 * 调用DeepSeek API生成AI批注
 * @param pdfText - PDF文本内容
 * @param config - 可选配置
 * @returns AI服务响应
 */
export async function callDeepSeekAPI(
  pdfText: string, 
  config: Partial<AIAnnotationConfig> = {}
): Promise<AIServiceResponse> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  if (!pdfText || !pdfText.trim()) {
    throw createAPIError('INVALID_INPUT', 'PDF文本内容为空')
  }

  const prompt = finalConfig.prompt || buildAnnotationPrompt(pdfText)
  
  console.log("📤 调用DeepSeek API，prompt长度:", prompt.length)

  let lastError: any = null
  
  // 重试机制
  for (let attempt = 1; attempt <= (finalConfig.maxRetries || 1); attempt++) {
    try {
      console.log(`🔄 第 ${attempt} 次尝试调用API...`)
      
      const response = await performAPICall(prompt, finalConfig)
      
      console.log("✅ API调用成功")
      return {
        content: response,
        status: 'success'
      }
      
    } catch (error) {
      lastError = error
      console.warn(`❌ 第 ${attempt} 次API调用失败:`, (error as any).message)
      
      // 如果是最后一次尝试，抛出错误
      if (attempt === finalConfig.maxRetries) {
        break
      }
      
      // 等待后重试（递增延迟）
      await sleep(1000 * attempt)
    }
  }

  // 所有重试都失败了
  console.error("🚫 API调用最终失败:", lastError)
  throw lastError || createAPIError('UNKNOWN_ERROR', 'API调用失败')
}

/**
 * 执行实际的API调用
 * @param prompt - 请求prompt
 * @param config - 配置
 * @returns API响应内容
 */
async function performAPICall(prompt: string, config: AIAnnotationConfig): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeout)

  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        model: config.model,
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    console.log("📊 API响应状态:", response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("📋 API错误详情:", errorData)

      // 根据状态码提供具体错误信息
      throw createAPIError(
        getErrorCodeFromStatus(response.status),
        getErrorMessageFromStatus(response.status, errorData),
        { status: response.status, response: errorData }
      )
    }

    const data = await response.json()
    console.log("📄 API响应数据结构:", { hasContent: !!data.content, contentLength: data.content?.length })

    if (!data.content) {
      console.error("📭 API响应缺少content字段:", data)
      throw createAPIError('INVALID_RESPONSE', 'AI返回数据格式错误：缺少content字段', data)
    }

    return data.content

  } catch (error) {
    clearTimeout(timeoutId)

    // 处理网络超时
    if (error instanceof Error && error.name === 'AbortError') {
      throw createAPIError('TIMEOUT', `请求超时 (${config.timeout}ms)`)
    }

    // 处理网络错误
    if (error instanceof Error && error.message.includes('fetch')) {
      throw createAPIError('NETWORK_ERROR', '网络连接错误，请检查网络连接后重试')
    }

    // 重新抛出已处理的错误
    throw error
  }
}

/**
 * 根据HTTP状态码获取错误代码
 * @param status - HTTP状态码
 * @returns 错误代码
 */
function getErrorCodeFromStatus(status: number): string {
  switch (status) {
    case 401: return 'UNAUTHORIZED'
    case 403: return 'FORBIDDEN'
    case 404: return 'NOT_FOUND'
    case 429: return 'RATE_LIMITED'
    case 500:
    case 502:
    case 503:
    case 504: return 'SERVER_ERROR'
    default: return 'HTTP_ERROR'
  }
}

/**
 * 根据HTTP状态码获取用户友好的错误信息
 * @param status - HTTP状态码
 * @param errorData - 错误数据
 * @returns 错误信息
 */
function getErrorMessageFromStatus(status: number, errorData: any): string {
  switch (status) {
    case 401:
      return "API密钥无效，请检查配置"
    case 403:
      return "API访问被拒绝，请检查权限"
    case 404:
      return "AI服务端点未找到，请检查配置"
    case 429:
      return "API调用频率超限，请稍后重试"
    case 500:
    case 502:
    case 503:
    case 504:
      return "AI服务暂时不可用，请稍后重试"
    default:
      return `AI服务调用失败 (${status})`
  }
}

/**
 * 创建API错误对象
 * @param code - 错误代码
 * @param message - 错误信息
 * @param details - 错误详情
 * @returns API错误对象
 */
function createAPIError(code: string, message: string, details?: any): AIAnnotationError {
  const error = new Error(message) as any
  error.code = code
  error.details = details
  return error
}

/**
 * 休眠函数
 * @param ms - 毫秒数
 * @returns Promise
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 验证API配置
 * @param config - 配置对象
 * @returns 是否有效
 */
export function validateAPIConfig(config: Partial<AIAnnotationConfig>): boolean {
  if (config.maxRetries && (config.maxRetries < 1 || config.maxRetries > 10)) {
    console.warn("❌ maxRetries应该在1-10之间")
    return false
  }

  if (config.timeout && (config.timeout < 5000 || config.timeout > 120000)) {
    console.warn("❌ timeout应该在5秒-2分钟之间")
    return false
  }

  return true
}
