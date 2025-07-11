import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { prompt, model } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
    const modelName = process.env.DEEPSEEK_MODEL || model || "deepseek-chat"

    if (!apiKey) {
      console.error("DeepSeek API key not found in environment variables")
      return NextResponse.json({ error: "DeepSeek API key not configured" }, { status: 500 })
    }

    const endpoint = `${baseUrl}/chat/completions`

    console.log("Attempting to connect to DeepSeek API with:", {
      baseUrl,
      model: modelName,
      promptLength: prompt.length,
      endpoint: endpoint,
    })

    const requestBody = {
      model: modelName,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      stream: false,
    }

    try {
      console.log(`Trying endpoint: ${endpoint}`)

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

      console.log(`Response from ${endpoint}:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      })

      const responseText = await response.text()
      console.log(`Response body from ${endpoint}:`, responseText.substring(0, 500))

      if (response.ok) {
        let data
        try {
          data = JSON.parse(responseText)
        } catch (parseError) {
          console.error("Failed to parse response as JSON:", parseError)
          // Since we have only one endpoint, we can return an error directly
          return NextResponse.json(
            {
              error: "Failed to parse response from DeepSeek API",
              details: parseError instanceof Error ? parseError.message : String(parseError),
            },
            { status: 500 },
          )
        }

        if (data.choices && data.choices[0] && data.choices[0].message) {
          return NextResponse.json({
            content: data.choices[0].message.content,
            usage: data.usage,
          })
        } else if (data.error) {
          console.error("API returned error:", data.error)
          // Return the error from the API
          return NextResponse.json(
            {
              error: "DeepSeek API returned an error",
              details: data.error,
            },
            { status: 503 },
          )
        }
      } else {
        // The single endpoint failed, return the error
        console.error("API endpoint failed. Error:", {
          status: response.status,
          statusText: response.statusText,
          response: responseText,
        })
        return NextResponse.json(
          {
            error: "Failed to connect to DeepSeek API",
            details: {
              status: response.status,
              statusText: response.statusText,
              response: responseText,
            },
            message: "Please check your API key and base URL configuration",
          },
          { status: 503 },
        )
      }
    } catch (fetchError) {
      console.error(`Error with endpoint ${endpoint}:`, fetchError)
      // The single fetch failed, return the error
      return NextResponse.json(
        {
          error: "Failed to connect to DeepSeek API",
          details: fetchError instanceof Error ? fetchError.message : String(fetchError),
          message: "Please check your network connection or API configuration",
        },
        { status: 503 },
      )
    }
  } catch (error) {
    console.error("API route error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
