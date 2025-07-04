import { DocumentMetadata } from '@/types/document'

const STORAGE_KEY = 'uploaded-documents'
const SESSION_KEY = 'session-documents'

export class DocumentStorage {
  static getDocuments(): DocumentMetadata[] {
    if (typeof window === 'undefined') return []
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error reading documents from localStorage:', error)
      return []
    }
  }

  static addDocument(document: DocumentMetadata): void {
    if (typeof window === 'undefined') return
    
    try {
      const documents = this.getDocuments()
      documents.unshift(document) // 新文档添加到开头
      localStorage.setItem(STORAGE_KEY, JSON.stringify(documents))
    } catch (error) {
      console.error('Error saving document to localStorage:', error)
    }
  }

  static removeDocument(id: string): void {
    if (typeof window === 'undefined') return
    
    try {
      const documents = this.getDocuments()
      const filtered = documents.filter(doc => doc.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    } catch (error) {
      console.error('Error removing document from localStorage:', error)
    }
  }

  static getDocument(id: string): DocumentMetadata | null {
    const documents = this.getDocuments()
    return documents.find(doc => doc.id === id) || null
  }

  static clearAll(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing documents from localStorage:', error)
    }
  }

  static getTotalSize(): number {
    const documents = this.getDocuments()
    return documents.reduce((total, doc) => total + doc.size, 0)
  }

  static getCount(): number {
    return this.getDocuments().length
  }

  static getSessionDocuments(): DocumentMetadata[] {
    if (typeof window === 'undefined') return []
    
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error reading documents from sessionStorage:', error)
      return []
    }
  }

  static addSessionDocument(document: DocumentMetadata): void {
    if (typeof window === 'undefined') return
    
    try {
      const documents = this.getSessionDocuments()
      documents.unshift(document) // 新文档添加到开头
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(documents))
    } catch (error) {
      console.error('Error saving document to sessionStorage:', error)
    }
  }

  static removeSessionDocument(id: string): void {
    if (typeof window === 'undefined') return
    
    try {
      const documents = this.getSessionDocuments()
      const filtered = documents.filter(doc => doc.id !== id)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(filtered))
    } catch (error) {
      console.error('Error removing document from sessionStorage:', error)
    }
  }

  static clearSessionDocuments(): void {
    if (typeof window === 'undefined') return
    
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch (error) {
      console.error('Error clearing session documents:', error)
    }
  }

  static getSessionTotalSize(): number {
    const documents = this.getSessionDocuments()
    return documents.reduce((total, doc) => total + doc.size, 0)
  }

  static getSessionCount(): number {
    return this.getSessionDocuments().length
  }
}
