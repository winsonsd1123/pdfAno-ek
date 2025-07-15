import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { prompt, model } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      console.error("DeepSeek API key not found in environment variables")
      return NextResponse.json({ error: "DeepSeek API key not configured" }, { status: 500 })
    }

    const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
    const modelName = process.env.DEEPSEEK_MODEL || model || "deepseek-chat"
    const endpoint = `${baseUrl}/chat/completions`

    const requestBody = {
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
      stream: false,
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "User-Agent": "PDF-Annotator/1.0",
      },
      body: JSON.stringify(requestBody),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error("DeepSeek API error:", responseData)
      const errorDetails = responseData.error ? responseData.error.message : "Unknown API error"
      return NextResponse.json(
        {
          error: `Failed to connect to DeepSeek API: ${errorDetails}`,
          details: responseData,
        },
        { status: response.status }
      )
    }
    
    if (responseData.choices?.[0]?.message) {
      return NextResponse.json({
        content: responseData.choices[0].message.content,
        usage: responseData.usage,
      })
    }
    
    // Handle cases where response is ok but data is not in expected format
    return NextResponse.json(
      { error: "Invalid response structure from DeepSeek API", details: responseData },
      { status: 502 } // Bad Gateway
    );

  } catch (error) {
    console.error("DeepSeek proxy API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
