import type { AIServiceResponse, AIAnnotationConfig, AIAnnotationError } from './pdf-types'

/**
 * AI批注API调用服务
 * 
 * 封装API调用逻辑，提供统一的错误处理和重试机制
 */

// 默认配置
const DEFAULT_CONFIG: AIAnnotationConfig = {
  maxRetries: 3,
  timeout: 90000 // 90秒超时
}

/**
 * 调用AI服务生成批注
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
  
  console.log("📤 调用AI服务，文本长度:", pdfText.length)

  let lastError: any = null
  
  // 重试机制
  for (let attempt = 1; attempt <= (finalConfig.maxRetries || 1); attempt++) {
    try {
      console.log(`🔄 第 ${attempt} 次尝试调用API...`)
      
      const response = await performAPICall(pdfText, finalConfig)
      
      console.log("✅ API调用成功")
      return {
        content: response,
        status: 'success'
      }
      
    } catch (error) {
      lastError = error
      console.warn(`❌ 第 ${attempt} 次API调用失败:`, (error as any).message)
      
      if (attempt === finalConfig.maxRetries) {
        break
      }
      
      await sleep(1000 * attempt)
    }
  }

  console.error("🚫 API调用最终失败:", lastError)
  throw lastError || createAPIError('UNKNOWN_ERROR', 'API调用失败')
}

/**
 * 执行实际的API调用
 * @param pdfText - PDF文本内容
 * @param config - 配置
 * @returns API响应内容
 */
async function performAPICall(pdfText: string, config: AIAnnotationConfig): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeout)

  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: pdfText
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    console.log("📊 API响应状态:", response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("📋 API错误详情:", errorData)

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

    if (error instanceof Error && error.name === 'AbortError') {
      throw createAPIError('TIMEOUT', `请求超时 (${config.timeout}ms)`)
    }

    if (error instanceof Error && error.message.includes('fetch')) {
      throw createAPIError('NETWORK_ERROR', '网络连接错误，请检查网络连接后重试')
    }

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
