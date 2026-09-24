---
title: "欢迎来到我的博客 🎉"
description: "这是第一篇文章，教你如何发文字、图片和视频"
pubDate: 2026-09-24
tags: ["公告", "教程"]
cover: ""
---

# 欢迎！

这是你的第一篇博客。这个页面就是**你发帖的样子**——一段普通的 Markdown 文本。

## 怎么插入图片？

把图片文件放到网站的 `public/uploads/` 文件夹里，然后这样写：

```markdown
![图片说明](/uploads/你的图片名.jpg)
```

> 支持的格式：jpg、png、gif、webp。图片会自动缩放，无需处理尺寸。

## 怎么插入视频？

推荐把视频传到 **B站** 或 **YouTube**，然后复制"嵌入代码"粘贴进来即可（长视频不占自己空间，加载也快）：

```html
<iframe src="https://player.bilibili.com/player.html?bvid=BV1xxxxxxxxx"
        width="100%" height="430" frameborder="0" allowfullscreen></iframe>
```

短视频也可以直接放文件（mp4）：

```html
<video controls src="/uploads/你的视频.mp4"></video>
```

## 更多排版

**加粗**、*斜体*、~~删除线~~、[链接](https://example.com)

用 `#` 表示标题：

# 一级标题
## 二级标题
### 三级标题

引用：

> 一段引用文字。

列表：
- 第一条
- 第二条

数字列表：
1. 第一
2. 第二

分隔线：
---

## 发帖就这么简单

1. 复制 `src/content/posts/` 里任意 `.md` 文件
2. 改成你的文件名（英文或拼音）
3. 修改顶部和正文，保存
4. 部署后即自动上线

具体发帖流程详见项目根目录的 `使用说明.md`。
