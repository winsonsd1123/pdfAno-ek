import { createSupabaseAdminClient } from "@/lib/supabase"
import { DocumentEntity } from "@/models/document"

export class DocumentRepository {
  private supabase: any;

  constructor() {
    this.supabase = createSupabaseAdminClient();
  }

  /**
   * 创建新的文档记录
   */
  async create(data: {
    name: string
    url: string
    uploader_id: string
    status?: 'DRAFT' | 'REVIEWING' | 'REVIEWED'
  }): Promise<DocumentEntity> {
    const { data: article, error } = await this.supabase
      .from('articles')
      .insert({
        name: data.name,
        url: data.url,
        uploader_id: data.uploader_id,
        status: data.status || 'DRAFT'
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create article: ${error.message}`)
    }

    return article as DocumentEntity
  }

  /**
   * 根据用户ID查询相关的文档列表
   */
  async findManyByUserId(userId: string): Promise<DocumentEntity[]> {
    const { data: articles, error } = await this.supabase
      .from('articles')
      .select('*, uploader:profiles!articles_uploader_id_fkey(full_name), reviewer:profiles!articles_reviewer_id_fkey(full_name)')
      .or(`uploader_id.eq.${userId},reviewer_id.eq.${userId}`)
      .order('uploaded_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch articles: ${error.message}`)
    }

    return articles as DocumentEntity[]
  }

  /**
   * 根据文档ID查询单个文档
   */
  async findById(id: string): Promise<DocumentEntity | null> {
    const { data: article, error } = await this.supabase
      .from('articles')
      .select('*, uploader:profiles!articles_uploader_id_fkey(full_name), reviewer:profiles!articles_reviewer_id_fkey(full_name)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // 文档不存在
      }
      throw new Error(`Failed to fetch article: ${error.message}`)
    }

    return article as DocumentEntity
  }

  /**
   * 根据文档ID删除记录
   */
  async remove(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('articles')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete article: ${error.message}`)
    }
  }

  async isUserAuthorizedForArticle(userId: string, articleId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('articles')
      .select('id')
      .eq('id', articleId)
      .or(`uploader_id.eq.${userId},reviewer_id.eq.${userId}`)
      .maybeSingle();

    if (error) {
      console.error('Error checking article authorization:', error);
      return false;
    }

    return !!data;
  }
} 