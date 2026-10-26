// ============================================================
// 网站全局设置 —— 想调整网站行为，一般只需要改这个文件
// （在 GitHub 网页上点开这个文件 → 铅笔编辑 → 改完 Commit 即可）
// ============================================================

export const siteConfig = {
  // 网站名称（浏览器标题、页脚显示）
  siteTitle: 'shuangyun 的博客',

  // 首页显示哪些分类的文章？
  //   'suibi'  = 只显示「随笔」
  //   'shiji'  = 只显示「事记」
  //   'memo'   = 只显示「memo」
  //   'all'    = 显示全部
  //   也可以写成数组，例如 ['suibi', 'memo']
  homeCategories: 'suibi' as 'suibi' | 'shiji' | 'memo' | 'all' | Array<'suibi' | 'shiji' | 'memo'>,

  // 评论系统 Waline 的服务地址。
  // 部署好 Waline 之后，把它给你的地址填在这里，例如 'https://xxx.vercel.app'
  // 不填的话，文章底部不会显示评论框。
  walineServerURL: '',
};

// 三个分类的展示信息（一般不用改）
export const categories = {
  suibi: { label: '随笔', path: '/essays/', intro: '长一点的文字：所思所想，认真写下的文章。' },
  shiji: { label: '事记', path: '/journal/', intro: '生活里发生的事，按时间记下来。' },
  memo: { label: 'memo', path: '/memo/', intro: '短想法、碎片、随手记。' },
} as const;

export type CategoryKey = keyof typeof categories;
