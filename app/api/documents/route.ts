import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { DocumentService } from '@/services/documentService'
import { DocumentListResponse } from '@/models/document'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as DocumentListResponse, { status: 401 })
  }
  
  const userId = (session.user as any).id

  try {
    const documentService = new DocumentService()
    const documents = await documentService.getDocumentList(userId)

    return NextResponse.json({ 
      success: true, 
      data: documents 
    } as DocumentListResponse)

  } catch (error) {
    console.error('Error fetching documents:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      success: false, 
      error: `Failed to fetch documents: ${errorMessage}` 
    } as DocumentListResponse, { status: 500 })
  }
}
