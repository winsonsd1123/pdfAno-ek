import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { AiService } from "@/services/aiService"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text content is required" }, { status: 400 })
    }

    const aiService = new AiService()
    const result = await aiService.analyze(text)

    return NextResponse.json(result)
  } catch (error) {
    console.error("AI service error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
