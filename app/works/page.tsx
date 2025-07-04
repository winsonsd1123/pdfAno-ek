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
import { FileText, Eye, Edit3, Trash2, AlertCircle } from "lucide-react"
import { DocumentStorage } from "@/lib/document-storage"
import { DocumentMetadata } from "@/types/document"
import { useRouter } from "next/navigation"

export default function WorksPage() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const fetchDocuments = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/documents')
      const result = await response.json()
      
      if (result.success) {
        setDocuments(result.documents)
      } else {
        console.error('Failed to fetch documents:', result.error)
        // 如果API失败，回退到localStorage
        setDocuments(DocumentStorage.getDocuments())
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
      // 如果网络错误，回退到localStorage
      setDocuments(DocumentStorage.getDocuments())
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const handleDelete = async (document: DocumentMetadata) => {
    if (!confirm(`确定要删除 "${document.name}" 吗？`)) {
      return
    }

    setIsDeleting(document.id)

    try {
      const response = await fetch('/api/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blobPath: document.blobPath,
        }),
      })

      const result = await response.json()

      if (result.success) {
        DocumentStorage.removeDocument(document.id)
        // 重新获取文档列表
        await fetchDocuments()
      } else {
        alert(`删除失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('删除失败，请重试')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleAnnotate = (document: DocumentMetadata) => {
    const params = new URLSearchParams({
      docId: document.id,
      url: document.url,
      name: document.name
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
            <div className="flex space-x-8">
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
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">批注工作台</h1>
          <p className="text-gray-600">管理和批注您的PDF文档</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">存储文档</p>
                  <p className="text-3xl font-bold text-gray-900">{documents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <FileText className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">总存储大小</p>
                  <p className="text-3xl font-bold text-gray-900">{formatFileSize(documents.reduce((total, doc) => total + doc.size, 0))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">文档列表</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-spin">⟳</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">加载中...</h3>
                <p className="text-gray-500">正在获取文档列表</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无文档</h3>
                <p className="text-gray-500 mb-4">
                  还没有上传任何PDF文档
                </p>
                <Button onClick={() => router.push('/')} className="bg-black hover:bg-gray-800">
                  去上传文档
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文档名称</TableHead>
                    <TableHead>上传时间</TableHead>
                    <TableHead>文件大小</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-red-500" />
                          <span className="truncate max-w-xs" title={doc.name}>
                            {doc.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1 text-gray-600">
                          <span>{formatDate(doc.uploadTime)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatFileSize(doc.size)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
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
                            onClick={() => handleAnnotate(doc)}
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            批注
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(doc)}
                            disabled={isDeleting === doc.id}
                          >
                            <Trash2 className="h-4 w-4" />
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
