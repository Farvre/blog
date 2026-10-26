// 搜索用的文章索引（构建时生成 /search.json，导航栏搜索框读它）
import { getCollection } from 'astro:content';

export async function GET() {
  const posts = (await getCollection('posts'))
    .filter((p) => !p.data.draft)
    .sort((a, b) => (b.data.pubDate?.getTime() ?? 0) - (a.data.pubDate?.getTime() ?? 0));

  const data = posts.map((p) => ({
    title: p.data.title,
    url: `/posts/${p.id}/`,
    date: p.data.pubDate ? new Date(p.data.pubDate).toISOString().slice(0, 10) : '',
    tags: p.data.tags ?? [],
    text: (p.body ?? '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500),
  }));

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
