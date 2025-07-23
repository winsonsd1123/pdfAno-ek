"use client"

import type React from "react"

import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { DocumentStorage } from "@/lib/document-storage" // 1. 干掉野路子 localStorage 存储
// import { DocumentMetadata, UploadResponse } from "@/types/document" // 2. 移除旧的类型定义
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { upload } from "@vercel/blob/client"
import { UPLOAD_CONFIG } from "@/config/upload"
import { validateFile } from "@/lib/client/uploadUtils"
import { FileUploadError } from "@/lib/common/errors"

// 定义一个临时的文章类型，理想情况下应该从 Supabase types 导入
type Article = {
  id: string
  name: string
  url: string
  status: string
  uploader_id: string
  reviewer_id: string | null
  uploaded_at: string
}

export default function HomePage() {
  const [uploadedDocuments, setUploadedDocuments] = useState<Article[]>([]) // 3. 使用新的类型
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>("")
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()

  // 从 NextAuth session 中获取用户状态
  const isAuthenticated = status === "authenticated"
  const isAdmin = session?.user?.role === "admin"
  const loading = status === "loading"
  const { toast } = useToast()

  useEffect(() => {
    const error = searchParams.get("error")
    if (error) {
      // 使用微小的延迟来确保Toaster组件已准备好接收事件
      setTimeout(() => {
        let description = "发生未知错误"
        if (error === "access_denied") {
          description = "您没有权限访问所请求的页面。"
        } else if (error === "permission_check_failed") {
          description = "无法验证您的权限，请稍后重试。"
        }
        toast({
          title: "访问受限",
          description: description,
          variant: "destructive",
        })
      }, 100)
    }
  }, [searchParams, toast])

  // 不需要useEffect，直接用空数组初始化，纯内存状态

  const handleFileUpload = async (file: File) => {
    if (!file) return

    setIsUploading(true)
    setUploadStatus("正在验证文件...")

    try {
      // 1. 验证文件
      validateFile(file, {
        maxSize: UPLOAD_CONFIG.maxSize,
        allowedTypes: UPLOAD_CONFIG.allowedTypes,
      })

      setUploadStatus("正在上传...")

      // 2. 使用 Vercel Blob 的 upload 函数直接上传
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload/request-url",
        clientPayload: JSON.stringify({ originalName: file.name }),
        // 添加上传进度回调
        onUploadProgress: ({ percentage }) => {
          setUploadStatus(`正在上传... ${percentage}%`)
        },
      })

      setUploadStatus("正在保存文件信息...")

      // 3. 通知后端上传完成
      const completeResponse = await fetch("/api/upload/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blobUrl: blob.url,
          originalName: file.name,
        }),
      })

      if (!completeResponse.ok) {
        const error = await completeResponse.json()
        throw new Error(error.error || "保存文件信息失败")
      }

      const newArticle = await completeResponse.json()
      setUploadedDocuments((prev) => [newArticle, ...prev])
      setUploadStatus("上传成功！")
    } catch (error) {
      console.error("Upload error:", error)
      let message = "发生未知错误，请稍后重试。"
      const variant: "default" | "destructive" | null | undefined = "destructive"

      if (error instanceof FileUploadError) {
        message = error.message
      } else if (error instanceof Error) {
        // 处理 Vercel Blob SDK 可能抛出的错误或其他标准错误
        message = error.message
      }

      setUploadStatus(message)

      toast({
        title: "上传失败",
        description: message,
        variant,
      })
    } finally {
      setIsUploading(false)
      // 5秒后清除状态消息
      setTimeout(() => setUploadStatus(""), 5000)
    }
  }

  const handleDelete = async (docId: string) => {
    // 从UI上立即移除，提供更好的用户体验
    setUploadedDocuments((docs) => docs.filter((d) => d.id !== docId))

    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        // 如果删除失败，把项目加回来，并提示用户
        alert("删除失败，请稍后重试。")
        // 这里可以实现更复杂的回滚逻辑，但对于MVP，alert就够了
        // 理想情况下，我们需要重新获取一次列表来同步状态
      }
    } catch (error) {
      alert("删除时发生网络错误。")
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">PDF 智能标注平台</h1>
          <p className="text-xl text-gray-600 mb-8">使用 AI 技术为您的 PDF 文档提供智能标注和分析</p>
          <div className="space-x-4">
            <Link href="/login">
              <Button size="lg">开始使用</Button>
            </Link>
            <Link href="/api/test">
              <Button variant="outline" size="lg">
                测试 API
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>智能标注</CardTitle>
              <CardDescription>AI 自动识别和标注文档中的重要内容</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">使用先进的自然语言处理技术，自动识别文档中的关键信息并进行智能标注。</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>协作编辑</CardTitle>
              <CardDescription>多人实时协作，共同完成文档标注</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">支持多用户同时在线编辑，实时同步标注内容，提高团队协作效率。</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>导出分享</CardTitle>
              <CardDescription>多种格式导出，便于分享和存档</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">支持导出为 PDF、Word、Markdown 等多种格式，方便分享和长期存档。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
