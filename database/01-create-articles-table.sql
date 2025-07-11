-- 01-create-articles-table.sql

-- 1. 创建 article_status 枚举类型
-- 根据用户反馈，为降低数据库耦合，不再使用 ENUM 类型，改用 TEXT 类型。
-- CREATE TYPE article_status AS ENUM ('DRAFT', 'PENDING_REVIEW', 'IN_REVIEW', 'REVIEW_COMPLETE');

-- 2. 创建 articles 表
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    uploader_id UUID NOT NULL REFERENCES profiles(id),
    reviewer_id UUID REFERENCES profiles(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- 添加一个检查约束来模拟 ENUM 的效果，保证数据完整性
    CONSTRAINT status_check CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'IN_REVIEW', 'REVIEW_COMPLETE'))
);

-- 3. 为 RLS 创建准备（根据用户反馈，暂时不启用）
-- ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow full access to own articles" 
-- ON articles
-- FOR ALL
-- USING (auth.uid() = uploader_id);

-- CREATE POLICY "Allow read access to assigned reviewers"
-- ON articles
-- FOR SELECT
-- USING (auth.uid() = reviewer_id);

COMMENT ON TABLE articles IS '存储论文文档的元数据和状态';
COMMENT ON COLUMN articles.name IS '论文名称，通常源于文件名';
COMMENT ON COLUMN articles.url IS '文件在 Vercel Blob Storage 中的存储链接';
COMMENT ON COLUMN articles.status IS '论文的当前状态 (DRAFT, PENDING_REVIEW, IN_REVIEW, REVIEW_COMPLETE)';
COMMENT ON COLUMN articles.uploader_id IS '上传该论文的用户ID';
COMMENT ON COLUMN articles.reviewer_id IS '被指派审阅该论文的老师ID';
COMMENT ON COLUMN articles.uploaded_at IS '论文上传时间'; 