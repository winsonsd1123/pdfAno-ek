"use client"

import React, { useState, useCallback, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AnnotationBubble, AnnotationContent, AnnotationHeader, AnnotationBody } from "@/components/ui/annotation-bubble"
import { AnnotationIcon, AnnotationAuthorName } from "@/components/ui/annotation-icon"
import { QuotedText } from "@/components/ui/quoted-text"
import { Search, MessageSquare, MapPin, MoreVertical, Trash2 } from "lucide-react"
import { usePdfAnoContext } from '@/contexts/PdfAnoContext'
import { createAnnotationRoles, addDefaultAuthorInfo, getCurrentTimestamp, formatTimestamp } from '@/lib/annotation-utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Internal Component for Search Tab
function SearchTab({ showCoordinates, onToggleCoordinates, onSearch }: { showCoordinates: boolean; onToggleCoordinates: () => void, onSearch: (query: string) => void }) {
  const { searchResults, currentSearchIndex, goToSearchResult } = usePdfAnoContext()
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearch = () => {
    onSearch(searchQuery)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-4 h-4" />
          Search
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search in PDF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") handleSearch()
            }}
          />
          <Button onClick={handleSearch} size="sm">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">{searchResults.length} results found</div>
              <Button size="sm" variant="outline" onClick={onToggleCoordinates}>
                <MapPin className="w-3 h-3 mr-1" />
                {showCoordinates ? "Hide" : "Show"} Coords
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => goToSearchResult(currentSearchIndex - 1)} disabled={currentSearchIndex <= 0}>
                Previous
              </Button>
              <Button size="sm" variant="outline" onClick={() => goToSearchResult(currentSearchIndex + 1)} disabled={currentSearchIndex >= searchResults.length - 1}>
                Next
              </Button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 text-sm border rounded cursor-pointer transition-colors ${index === currentSearchIndex ? "bg-blue-100 border-blue-300" : "hover:bg-gray-50"}`}
                  onClick={() => goToSearchResult(index)}
                >
                  <div className="font-medium text-blue-600">Page {result.pageIndex + 1}</div>
                  <div className="text-gray-800 font-medium">"{result.text}"</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 添加删除菜单组件
function DeleteMenu({ onDelete }: { onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDelete} className="text-red-600">
          <Trash2 className="mr-2 h-4 w-4" />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Internal Component for Annotations Tab
function AnnotationsTab() {
  const {
    annotations,
    setAnnotations,
    selectedAnnotation,
    setSelectedAnnotation,
    sortAnnotations,
    annotationPanelRef,
    annotationItemRefs,
    editingContent,
    setEditingContent,
    handleEditAnnotation,
    handleEditReply,
    toggleAnnotationEditMode,
    toggleReplyEditMode,
    deleteAnnotation,
  } = usePdfAnoContext()
  const { profile } = useAuth()

  return (
    <Card className="flex-1 flex flex-col">
      <CardContent className="p-1 flex-1 flex flex-col space-y-2">
        <div ref={annotationPanelRef} className="space-y-1 flex-1 overflow-y-auto max-h-[calc(100vh-160px)]">
          {sortAnnotations(annotations).map((annotation) => (
            <AnnotationBubble
              key={annotation.id}
              className={selectedAnnotation?.id === annotation.id ? "bg-blue-50 border-blue-300" : ""}
              onClick={() => {
                setAnnotations((prev) => prev.map((a) => a.id === annotation.id ? { ...a, isExpanded: !a.isExpanded } : a))
                setSelectedAnnotation(annotation)
              }}
            >
              <div className="flex w-full gap-2">
                <div ref={(el) => { if (el) { annotationItemRefs.current.set(annotation.id, el) } else { annotationItemRefs.current.delete(annotation.id) } }} className="flex-shrink-0">
                  <AnnotationIcon author={annotation.author} type={annotation.type} />
                </div>
                <AnnotationContent className="w-full">
                  <AnnotationHeader>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <AnnotationAuthorName author={annotation.author} />
                        <span className="text-gray-400">•</span>
                        <span>{formatTimestamp(annotation.timestamp)}</span>
                      </div>
                      <DeleteMenu onDelete={() => deleteAnnotation(annotation.id)} />
                    </div>
                  </AnnotationHeader>
                  {annotation.aiAnnotation ? (
                    <>
                      <QuotedText text={annotation.aiAnnotation.selectedText} />
                      {annotation.isEditing ? (
                        <div className="mt-2">
                          <Textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="w-full" />
                          <div className="flex justify-end gap-2 mt-2">
                            <Button size="sm" variant="outline" onClick={() => toggleAnnotationEditMode(annotation)}>Cancel</Button>
                            <Button size="sm" onClick={() => handleEditAnnotation(annotation, editingContent)}>Save</Button>
                          </div>
                        </div>
                      ) : (
                        <AnnotationBody isExpanded={annotation.isExpanded || false} maxLines={3} onClick={() => toggleAnnotationEditMode(annotation)} className="cursor-pointer">
                          {annotation.aiAnnotation.mergedContent}
                        </AnnotationBody>
                      )}
                    </>
                  ) : (
                     <AnnotationBody isExpanded={annotation.isExpanded || false} maxLines={3}>
                        {annotation.content}
                      </AnnotationBody>
                  )}
                </AnnotationContent>
              </div>
              
              {annotation.isExpanded && (
                <div className="pl-8 pb-2 w-full mt-2 annotation-replies-area">
                  {/* 回复列表 */}
                  {annotation.replies && annotation.replies.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {annotation.replies.map(reply => (
                        <div key={reply.id} className="flex items-start gap-2">
                          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs flex-shrink-0">{reply.author.avatar || "💬"}</span>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                                <span>{reply.author.name}</span>
                                <span className="text-gray-400">•</span>
                                <span>{formatTimestamp(reply.timestamp)}</span>
                              </div>
                              <DeleteMenu onDelete={() => {
                                setAnnotations(prev => prev.map(a => 
                                  a.id === annotation.id ? {
                                    ...a,
                                    replies: a.replies?.filter(r => r.id !== reply.id)
                                  } : a
                                ))
                              }} />
                            </div>
                            {reply.isEditing ? (
                              <div className="mt-1">
                                <Textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="w-full min-h-[60px] text-sm"
                                />
                                <div className="flex justify-end gap-2 mt-1">
                                  <Button size="sm" variant="outline" onClick={() => toggleReplyEditMode(annotation.id, reply)} className="h-7 text-xs">
                                    取消
                                  </Button>
                                  <Button size="sm" className="h-7 text-xs" onClick={() => handleEditReply(annotation.id, reply.id, editingContent)}>
                                    保存
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="text-sm text-gray-700 whitespace-pre-line break-words cursor-pointer hover:bg-gray-50 p-1 rounded"
                                onClick={() => toggleReplyEditMode(annotation.id, reply)}
                              >
                                {reply.content}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 添加回复输入框 */}
                  <form onSubmit={e => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const input = form.reply as HTMLInputElement;
                    const value = input.value.trim();
                    if (!value) return;
                    setAnnotations(prev => prev.map(a =>
                      a.id === annotation.id
                        ? {
                            ...a,
                            replies: [
                              ...(a.replies || []),
                              {
                                id: Date.now().toString(),
                                author: {
                                  name: profile?.full_name || profile?.username || "匿名用户",
                                  role: profile?.role?.name || "普通用户",
                                  avatar: profile?.avatar_url || "👤", 
                                  color: "green"
                                },
                                content: value,
                                timestamp: getCurrentTimestamp(),
                              }
                            ]
                          }
                        : a
                    ));
                    input.value = "";
                  }} className="flex gap-2 items-center mt-2">
                    <input
                      name="reply"
                      type="text"
                      placeholder="添加回复"
                      className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring"
                      autoComplete="off"
                    />
                    <button type="submit" className="text-blue-600 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 flex-shrink-0">
                      回复
                    </button>
                  </form>
                </div>
              )}
            </AnnotationBubble>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


// Internal Component for Debug Panel
function DebugPanel() {
  const { debugInfo } = usePdfAnoContext()
  if (debugInfo.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4" />
          Text Location Debug Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-64 overflow-y-auto">
        {debugInfo.map((info, index) => (
          <div key={index} className={`p-3 border rounded-lg text-xs ${info.found ? "bg-green-50" : "bg-red-50"}`}>
            <div className="font-medium">{info.found ? "✅ Found" : "❌ Not Found"}: "{info.text}" on page {info.page}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Main SidePanel Component
export function SidePanel({ showDebugPanel }: { showDebugPanel: boolean }) {
  const { annotations, searchText, panelWidth, setPanelWidth } = usePdfAnoContext()
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState("annotations")
  const [isResizing, setIsResizing] = useState(false)
  const [showCoordinates, setShowCoordinates] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = window.innerWidth - e.clientX
    const minWidth = 300
    const maxWidth = window.innerWidth * 0.7
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setPanelWidth(newWidth)
    }
  }, [isResizing, setPanelWidth])

  const handleMouseUp = useCallback(() => setIsResizing(false), [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const handleSearch = (query: string) => {
    searchText({ query })
  }

  return (
    <>
      <div
        className="w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors"
        onMouseDown={handleMouseDown}
        style={{ position: 'fixed', right: `${panelWidth}px`, top: 0, bottom: 0, zIndex: 10 }}
      />
      <div className="bg-white border-l flex flex-col fixed right-0 top-0 bottom-0" style={{ width: `${panelWidth}px` }}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 m-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">搜索</TabsTrigger>
            <TabsTrigger value="annotations">批注 ({annotations.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="flex-1 space-y-4">
            <SearchTab
              showCoordinates={showCoordinates}
              onToggleCoordinates={() => setShowCoordinates(s => !s)}
              onSearch={handleSearch}
            />
          </TabsContent>
          
          <TabsContent value="annotations" className="flex-1 flex flex-col">
            <AnnotationsTab />
          </TabsContent>
        </Tabs>
        
        {showDebugPanel && (
          <div className="p-4 border-t">
            <DebugPanel />
          </div>
        )}
      </div>
    </>
  )
}
