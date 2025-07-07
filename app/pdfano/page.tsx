"use client"

import React, { useState } from "react"
import { useSearchParams } from "next/navigation"
import { PdfAnoProvider, usePdfAnoContext } from "@/contexts/PdfAnoContext"
import { PdfToolbar } from "@/components/pdf-ano/PdfToolbar"
import { PdfViewer } from "@/components/pdf-ano/PdfViewer"
import { SidePanel } from "@/components/pdf-ano/SidePanel"

function PdfAnoLayout({ docName }: { docName: string }) {
  const { loading, error, panelWidth } = usePdfAnoContext()
  const [showDebugPanel, setShowDebugPanel] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading PDF...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }
  
  // The main UI structure
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Main content area */}
      <div 
        className="flex-1 flex flex-col transition-all duration-300 ease-in-out" 
        style={{ marginRight: `${panelWidth}px` }}
      >
        <PdfToolbar 
          docName={docName} 
          showDebugPanel={showDebugPanel}
          onToggleDebugPanel={() => setShowDebugPanel(prev => !prev)} 
        />
        <PdfViewer />
      </div>
      
      {/* Side panel area */}
      <SidePanel showDebugPanel={showDebugPanel} />
    </div>
  )
}


export default function PdfAnoPage() {
  const searchParams = useSearchParams()
  
  // Get doc info from URL, provide fallback
  const docUrl = searchParams.get('url') || "https://xpzbccdjc5ty6al1.public.blob.vercel-storage.com/advertisement-computing-rrttEVTmdSQcWy9D17QnNq77h49KFV.pdf"
  const docName = searchParams.get('name') || 'Unknown Document'
  
  return (
    <PdfAnoProvider docUrl={docUrl}>
      <PdfAnoLayout docName={docName} />
    </PdfAnoProvider>
  )
}
