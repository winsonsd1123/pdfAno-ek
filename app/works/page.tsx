"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { FileText, Eye, Edit3, Trash2, AlertCircle, Loader2 } from "lucide-react"
// import { DocumentStorage } from "@/lib/document-storage" // 1. 移除 LocalStorage 依赖
// import { DocumentMetadata } from "@/types/document" // 移除旧类型
import { useRouter } from "next/navigation"
import { UserAvatarMenu } from "@/components/ui/user-avatar-menu"

// 2. 使用统一的文章类型定义
type Article = {
  id: string;
  status: string;
  url: string;
  uploaded_at: string;
  uploader: {
    id: string;
    full_name: string;
  };
  reviewer?: {
    id: string;
    full_name: string;
  };
}

// API 响应类型
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
}

// 从 URL 中提取文件名
function getFileNameFromUrl(url: string): string {
  try {
    const urlParts = url.split('/')
    const fileName = urlParts[urlParts.length - 1]
    // URL decode 并移除可能的时间戳或其他后缀
    const decodedName = decodeURIComponent(fileName).split('_')[0] + '.pdf'
    return decodedName
  } catch (error) {
    console.error('Error extracting filename from URL:', error)
    return '未知文件名'
  }
}

export default function WorksPage() {
  const [documents, setDocuments] = useState<Article[]>([])
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const fetchDocuments = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/documents')
      const result = await response.json()
      
      if (response.ok && result.success && Array.isArray(result.data)) {
        setDocuments(result.data)
      } else {
        console.error('Failed to fetch documents:', result.error)
        setDocuments([])
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
      setDocuments([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  // 4. 改造删除逻辑
  const handleDelete = async (document: Article) => {
    if (!confirm(`确定要删除 "${getFileNameFromUrl(document.url)}" 吗？这会一并删除云端文件，无法恢复。`)) {
      return
    }
    setIsDeleting(document.id)
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result: ApiResponse<{ message: string }> = await response.json()
        if (result.success) {
          await fetchDocuments()
        } else {
          alert(`删除失败: ${result.error}`)
        }
      } else {
        const result = await response.json()
        alert(`删除失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('删除失败，请重试')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleAnnotate = (document: Article) => {
    const params = new URLSearchParams({
      url: document.url,
      name: getFileNameFromUrl(document.url),
      articleId: document.id,
    })
    router.push(`/pdfano?${params.toString()}`)
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2 py-1 text-xs font-medium text-gray-800 bg-gray-200 rounded-full">草稿</span>
      case 'PENDING_REVIEW':
        return <span className="px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">待审阅</span>
      case 'IN_REVIEW':
        return <span className="px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full">审阅中</span>
      case 'REVIEW_COMPLETE':
        return <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">已完成</span>
      default:
        return <span className="px-2 py-1 text-xs font-medium text-gray-800 bg-gray-200 rounded-full">{status}</span>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-gray-700" />
              <span className="text-xl font-semibold text-gray-900">PDF Analyzer</span>
            </Link>
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                首页
              </Link>
              <Link href="/works" className="text-gray-900 font-medium">
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
              <UserAvatarMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">批注工作台</h1>
            <p className="text-gray-600">管理和批注您的PDF论文</p>
          </div>
          
          {/* 新建按钮 - 现代简约设计 */}
          <Button 
            onClick={() => router.push('/')} 
            className="group relative bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-xl font-medium shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-700 hover:border-gray-600"
            size="lg"
          >
            <div className="flex items-center space-x-3">
              <div className="p-1 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-wide">上传论文</span>
            </div>
            {/* 悬停时的微妙光效 */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </Button>
        </div>

        {/* Stats Cards */}
        {/* 5. 移除依赖 size 的统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">总论文数</p>
                  <p className="text-3xl font-bold text-gray-900">{documents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">待处理</p>
                  <p className="text-3xl font-bold text-gray-900">{documents.filter(d => ['PENDING_REVIEW', 'IN_REVIEW'].includes(d.status)).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">论文列表</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="mx-auto h-12 w-12 text-gray-400 animate-spin" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">加载中...</h3>
                <p className="text-gray-500">正在从数据库获取论文列表</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无论文</h3>
                <p className="text-gray-500 mb-4">
                  还没有上传任何PDF论文
                </p>
                <Button onClick={() => router.push('/')} className="bg-black hover:bg-gray-800">
                  去上传论文
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>论文名称</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>上传者</TableHead>
                    <TableHead>批注者</TableHead>
                    <TableHead>上传时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-red-500" />
                          <span className="truncate max-w-xs" title={getFileNameFromUrl(doc.url)}>
                            {getFileNameFromUrl(doc.url)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusChip(doc.status)}</TableCell>
                      <TableCell>{doc.uploader.full_name}</TableCell>
                      <TableCell>{doc.reviewer?.full_name ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1 text-gray-600">
                          <span>{formatDate(doc.uploaded_at)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const params = new URLSearchParams({
                                url: doc.url,
                                name: getFileNameFromUrl(doc.url),
                                articleId: doc.id,
                              })
                              router.push(`/pdfano?${params.toString()}`)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            查看
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-black hover:bg-gray-800"
                            onClick={() => handleAnnotate(doc)}
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            批注
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isDeleting === doc.id}
                            onClick={() => handleDelete(doc)}
                          >
                            {isDeleting === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
