#!/usr/bin/env node
/**
 * 一键发帖脚本：npm run new-post
 * 用中文交互式提示，自动生成 Markdown 帖子文件。
 * 不懂代码也能用：照提示填标题、描述、标签即可。
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const postsDir = join(__dirname, '..', 'src', 'content', 'posts');
const uploadsDir = join(__dirname, '..', 'public', 'uploads');

const rl = createInterface({ input: stdin, output: stdout });

function slugify(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'post';
}

function help() {
  console.log(`
发帖小助手 —— 用法：
  标题：必填，比如 "我的第一篇日志"
  描述：一句话简介，显示在首页
  标签：逗号分隔，比如 "生活,日常"（可留空）
  封面：可留空；若图片已放进 public/uploads/，填 /uploads/文件名.jpg
  `);
}

async function main() {
  console.log('\n📝 ===== 发帖小助手 =====');
  await help();
  const today = new Date().toISOString().slice(0, 10).replace('T', ' ').slice(0, 10);

  const title = (await rl.question('📌 标题（必填）：')).trim();
  if (!title) { console.log('❌ 没填标题，已取消。'); process.exit(0); }
  const desc = (await rl.question('📄 描述（可选，一行简介）：')).trim();
  const tagsRaw = (await rl.question('🏷 标签（用逗号分隔，可留空）：')).trim();
  const cover = (await rl.question('🖼 封面路径（可空；如 /uploads/xxx.jpg）：')).trim();

  const tags = tagsRaw ? tagsRaw.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [];
  const date = today;

  const slug = slugify(title);
  let filename = `${date}-${slug}.md`;
  let counter = 2;
  while (existsSync(join(postsDir, filename))) {
    filename = `${date}-${slug}-${counter}.md`;
    counter++;
  }

  const fmLines = ['---', `title: "${title.replaceAll('"', '\\"')}"`];
  if (desc) fmLines.push(`description: "${desc.replaceAll('"', '\\"')}"`);
  fmLines.push(`pubDate: ${date}`);
  if (tags.length) fmLines.push(`tags: ${JSON.stringify(tags, null, 2).replace(/\n/g, '\n').replace(/,/g, ', ')}`);
  if (cover) fmLines.push(`cover: "${cover.replaceAll('"', '\\"')}"`);
  fmLines.push('draft: false', '---', '');

  const body = `# ${title}\n\n在这里写正文……\n\n<!-- 插入图片：![说明](/uploads/文件名.jpg) -->\n<!-- 插入视频：\n<iframe src="https://player.bilibili.com/player.html?bvid=BV1" width="100%" height="430" frameborder="0" allowfullscreen></iframe>\n-->\n`;

  if (!existsSync(postsDir)) mkdirSync(postsDir, { recursive: true });
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  const filePath = join(postsDir, filename);
  writeFileSync(filePath, fmLines.join('\n') + '\n' + body, 'utf8');

  console.log(`\n✅ 已创建：${filePath}`);
  console.log('   现在用任意文本编辑器打开它，把正文写好，保存即可。');
  console.log(`   （图片放到 ${uploadsDir}）`);
  rl.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
