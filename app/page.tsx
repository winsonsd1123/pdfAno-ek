"use client"

import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileText, Bot, CheckCircle, XCircle, Loader2, Eye, Edit3 } from "lucide-react"
import { DocumentStorage } from "@/lib/document-storage"
import { DocumentMetadata, UploadResponse } from "@/types/document"
import { useRouter } from "next/navigation"

export default function Home() {
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentMetadata[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>("")
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // 不需要useEffect，直接用空数组初始化，纯内存状态

  const handleFileUpload = async (file: File) => {
    if (!file) return

    setIsUploading(true)
    setUploadStatus("正在上传...")

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result: UploadResponse = await response.json()

      if (result.success && result.document) {
        // 添加到永久存储（工作台用）
        DocumentStorage.addDocument(result.document)
        // 直接更新React状态（首页用，纯内存状态）
        setUploadedDocuments(prev => [result.document!, ...prev])
        setUploadStatus("上传成功！")
      } else {
        setUploadStatus(`上传失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus("上传失败，请重试")
    } finally {
      setIsUploading(false)
      setTimeout(() => setUploadStatus(""), 5000)
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
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-gray-700" />
              <h1 className="text-xl font-semibold text-gray-900">PDF Analyzer</h1>
            </div>
            <div className="flex space-x-8">
              <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                首页
              </Link>
              <Link href="/works" className="text-gray-600 hover:text-gray-900 transition-colors">
                工作台
              </Link>
              <Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
                功能
              </Link>
              <Link href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
                定价
              </Link>
              <Link href="#help" className="text-gray-600 hover:text-gray-900 transition-colors">
                帮助
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            智能论文分析
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            上传您的PDF论文，我们将为您提供智能解析和批注功能，让论文阅读更加高效
          </p>
        </div>

        {/* Upload Section */}
        <div className="mb-12">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">上传论文</h3>
          {/* 外层实线框 */}
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            {/* 内层虚线框 */}
            <div 
              className={`border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                dragActive 
                  ? 'border-gray-600 bg-gray-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="py-12 px-8 text-center">
                {isUploading ? (
                  <Loader2 className="mx-auto h-16 w-16 text-gray-600 mb-4 animate-spin" />
                ) : (
                  <Upload className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                )}
                <h4 className="text-xl font-medium text-gray-900 mb-2">
                  {isUploading ? "正在上传..." : "拖拽PDF论文到此处"}
                </h4>
                <p className="text-gray-500 mb-2">支持单个或多个论文上传</p>
                <p className="text-gray-400 text-sm mb-6">
                论文名规范：只能包含英文字母、数字、下划线(_)和连字符(-)，不能包含空格
                </p>
                
                {uploadStatus && (
                  <div className={`mb-4 flex items-center justify-center space-x-2 ${
                    uploadStatus.includes('成功') ? 'text-green-600' : 
                    uploadStatus.includes('失败') ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {uploadStatus.includes('成功') && <CheckCircle className="h-5 w-5" />}
                    {uploadStatus.includes('失败') && <XCircle className="h-5 w-5" />}
                    {uploadStatus.includes('上传中') && <Loader2 className="h-5 w-5 animate-spin" />}
                    <span>{uploadStatus}</span>
                  </div>
                )}
                
                <Button 
                  className="bg-black hover:bg-gray-800 text-white px-6 py-2"
                  disabled={isUploading}
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                >
                  选择文件
                </Button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Uploaded Documents Section */}
        <div className="mb-12">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">本次上传论文 ({uploadedDocuments.length})</h3>
          <Card>
            <CardContent className="p-8">
              {uploadedDocuments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无上传的论文
                </div>
              ) : (
                <div className="space-y-4">
                  {uploadedDocuments.slice(0, 3).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-red-500" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(doc.size)} • {formatDate(doc.uploadTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(doc.url, '_blank')}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          查看
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="bg-black hover:bg-gray-800"
                          onClick={() => {
                            const params = new URLSearchParams({
                              docId: doc.id,
                              url: doc.url,
                              name: doc.name
                            })
                            router.push(`/pdfano?${params.toString()}`)
                          }}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          批注
                        </Button>
                      </div>
                    </div>
                  ))}
                  {uploadedDocuments.length > 3 && (
                    <div className="text-center pt-4">
                      <Button 
                        variant="link" 
                        onClick={() => router.push('/works')}
                      >
                        查看全部 {uploadedDocuments.length} 篇论文
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <div id="features" className="py-16">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">功能特色</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-6 border border-gray-200">
              <CardContent>
                <Upload className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                <h4 className="text-xl font-semibold text-gray-900 mb-2">快速上传</h4>
                <p className="text-gray-600">支持拖拽上传，批量处理多个PDF论文</p>
              </CardContent>
            </Card>
            <Card className="text-center p-6 border border-gray-200">
              <CardContent>
                <Bot className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                <h4 className="text-xl font-semibold text-gray-900 mb-2">智能解析</h4>
                <p className="text-gray-600">自动识别论文结构，提取关键信息</p>
              </CardContent>
            </Card>
            <Card className="text-center p-6 border border-gray-200">
              <CardContent>
                <FileText className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                <h4 className="text-xl font-semibold text-gray-900 mb-2">专业批注</h4>
                <p className="text-gray-600">在工作台进行专业的论文批注和协作</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-400">© 2024 PDF Analyzer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
