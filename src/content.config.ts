import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 帖子集合：每个发帖就是一个 Markdown 文件放在 src/content/posts/ 里
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    // 标题（必填）
    title: z.string(),
    // 一句话摘要，显示在列表页
    description: z.string().optional(),
    // 封面图：放在 public/uploads/ 里，写 /uploads/xxx.jpg（留空也行）
    cover: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v == null || v.trim() === '' ? undefined : v.trim())),
    // 发布日期 YYYY-MM-DD，不写则用文件时间（留空也行）
    pubDate: z.preprocess((v) => (v == null || v === '' ? undefined : v), z.coerce.date().optional()),
    // 分类：suibi=随笔，shiji=事记，memo=memo。不写默认算随笔
    category: z.enum(['suibi', 'shiji', 'memo']).optional().default('suibi'),
    // 标签数组
    tags: z.array(z.string()).optional(),
    // 草稿
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { posts };
