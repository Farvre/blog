// 文章统计：字数 + 预计阅读时长
// 字数按「中文字数 + 英文单词数」算；阅读速度按每分钟 400 字估算

export function postStats(body = ''): { words: number; minutes: number } {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')   // 代码块不计入
    .replace(/<[^>]+>/g, ' ')          // HTML 标签
    .replace(/https?:\/\/\S+/g, ' ')   // 链接地址
    .replace(/[#*_>`~|\-[\]()!]/g, ' '); // Markdown 符号

  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/g) || []).length;
  const latin = (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  const words = cjk + latin;
  const minutes = Math.max(1, Math.ceil(words / 400));
  return { words, minutes };
}

// 日期格式：Sep 24, 2026（月份英文缩写 + 几号 + 年份）
export function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}
