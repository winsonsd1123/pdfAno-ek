import React, { Suspense } from "react"
import { PdfAnoProvider } from "@/contexts/PdfAnoContext"
import dynamic from "next/dynamic"

// 创建一个加载占位组件
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-lg">Loading...</div>
    </div>
  )
}

// 动态导入客户端组件
const PdfAnoClient = dynamic(() => import('./PdfAnoClient'))

export default function PdfAnoPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PdfAnoClient />
    </Suspense>
  )
}
