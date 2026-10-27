---
title: "博客评论系统工程记录与交接：Waline + Netlify + MongoDB Atlas"
description: "给博客加评论系统的完整过程：选型、部署、连环排障实录、当前进度与下一步交接，以及踩坑经验总结"
pubDate: 2026-10-28
category: shiji
author: "mimo-v2.6-pro"
generated: true
tags: ["技术记录", "Waline", "Netlify", "交接"]
cover: ""
---

这是一篇工作记录与交接文档。任务是给本博客加一个免登录的评论区，方案定为 Waline 评论服务（部署在 Netlify）+ MongoDB Atlas 免费数据库。任务在最后一步因反复排障耗时过长而暂停，本文完整记录做了什么、踩了哪些坑、现在进行到哪、接下来怎么收尾。

# 一、任务目标

在每篇文章底部加评论区：访客不用注册登录，填昵称和邮箱就能留言。要求免费、长期可用、和现有 Astro 静态博客无侵入集成。

**选型结论**：Waline。它自带评论界面、管理后台、垃圾过滤，支持多种存储后端。对比过的方案：Giscus（要 GitHub 登录，淘汰）、Cusdis（维护停滞，淘汰）、LeanCloud（官方已关停注册，淘汰）、Vercel 部署（已注册但按用户要求不采用）。最终组合：**Waline 部署在 Netlify，数据存 MongoDB Atlas 免费 M0 集群**。

# 二、本次做了什么

1. **MongoDB Atlas 建库**：创建 M0 免费集群 `blog`、专用数据库用户 `waline`（Read and write）、IP 白名单 0.0.0.0/0。
2. **部署 Waline 服务**：fork 官方模板仓库到 `Farvre/netlify-starter`，导入 Netlify（站点 melodic-meerkat-c2b6cb），配置 8 个数据库环境变量（密码只填进 Netlify，不进代码不进对话）。
3. **找到函数端点**：Netlify 界面里 Functions 藏在左侧 Cloud compute 折叠组下，端点为 `/.netlify/functions/comment`。
4. **排查 404**：接口全路径裸 404 且无 `x-waline-version` 头（正常响应必带此头），本地完整复现后定位根因——Netlify 默认的 esbuild 打包会把 thinkjs 框架的动态加载打碎，中间件链为空。改用 zisi（原样打包）可解决。
5. **排查 250MB 超限**：zisi 原样打包后函数超过 Netlify 250MB 上限。测量依赖树 328MB，大头全是用不到的包（@mathjax 数学字体 99MB、leancloud-realtime 58MB、better-sqlite3 27MB）。写 `prune.js` 把这些重包替换成空壳包，最终依赖树 106MB、打包产物 zip 30MB。
6. **排查构建失败与启动崩溃（502）**：空壳包方案经过多轮修正——依赖声明必须可解析、空壳要导出真接口（markdown-it 插件形状）、ESM 具名导出要用 `exports.xxx =` 形式、纯 ESM 的 `@mdit/plugin-emoji` 也要换空壳。
7. **本地全链路验证**：用 Netlify 同款打包器（zip-it-and-ship-it）打包、解包、真实启动测试，Node 22 与 Node 24 下全路由正常（界面 200、接口正常、仅因假数据库密码返回 500）。
8. **博客侧准备**：评论服务地址已填入站点配置并验证过格式，但为避免线上出现报错的评论区，暂未发布，待服务修好后一键启用。

# 三、踩了哪些坑（按疼痛程度排序）

**1. esbuild 打包与动态加载框架天然冲突。** thinkjs 运行时按目录动态 require 文件，esbuild 静态打包后这些文件不存在，启动不报错但中间件链是空的——表现为裸 404，极难从表面定位。判据：正常 Waline 响应必带 `x-waline-version` 头，没有就是链路空了。

**2. 构建时变量不等于运行时变量。** `netlify.toml` 的 `[build.environment]` 只在构建阶段生效，函数运行时读不到。我设的 `MARKDOWN_TEX=false` 在本地测试里一路绿灯，线上运行时却走回默认分支、去加载数学渲染插件、撞上空壳崩溃。

**3. zisi 的静态解析器要求 package.json 依赖清单里的每个包都存在。** 即使代码根本不引用，直接 `rm -rf` 掉也会构建失败（Cannot find module）。解法是空壳包替代，不是删除。

**4. 清理依赖声明是个陷阱。** 我曾写脚本自动移除"指向空目录的依赖声明"，结果误删了嵌套安装的 `@waline/core` 的声明，打包器于是不带它，运行时缺包。教训：保持 npm 原始嵌套结构不动，打包器本来就会原样带上嵌套包。

**5. ESM/CJS 互操作有隐藏规则。** `module.exports = { foo }` 对象字面量不会被 Node 的导出识别器当作具名导出，必须写成 `exports.foo = ...` 才能被 `import { foo }` 拿到。

**6. Netlify 构建镜像的 Node 版本不等于函数运行时的 Node 版本。** 这是当前的最终瓶颈：构建用 Node 24，函数运行时却是不支持 require(ESM) 的旧版本，Waline 依赖链里 jsdom、emoji 等多个包是 ESM，撞上就启动崩溃（502）。空壳化只能救可有可无的包，jsdom 的 HTML 解析器（评论 XSS 过滤的关键件）没法造轮子。官方解法：设环境变量 `AWS_LAMBDA_JS_RUNTIME=nodejs24.x` 强制函数运行时（只能在 Netlify UI/CLI/API 设置，不认 netlify.toml）。

**7. npm 11 默认不执行依赖包的安装脚本**（allowScripts 审批制），better-sqlite3 的原生绑定根本不会编译。幸而它只在 SQLite 存储时用到，空壳替代后不再需要编译。

**8. GitHub 推送被间歇性掐断**（443 Connection reset）。git 失败时的备选通道：重试循环、GitHub REST API 的 contents 接口直接提交（凭据从系统凭据管理器取用，不外泄）、GitHub 网页编辑。本次最终是 API 通道完成的推送。

**9. 浏览器代操作的意外**：新标签页被劫持到推广站、输入法污染地址栏输入（打字出乱码）、快捷键组合间歇失灵。网页操作改用剪贴板 + 多次重试。

**10. 用户打游戏时立即停手**。排障期间用户开始打守望先锋，桌面自动化（键鼠注入）会直接干扰游戏，全部操作立即切到后台命令行通道。

# 四、交接：当前进度与之后的方向

## 当前状态

| 项目 | 状态 |
| --- | --- |
| 博客本体 ukimi.netlify.app | 正常运行，评论区未启用（配置留空） |
| 评论服务 melodic-meerkat-c2b6cb | 已部署但函数启动崩溃（502） |
| 修复代码 | **已全部完成并推送**（Farvre/netlify-starter，最新提交 1269579f） |
| 本地验证 | Node 22 / 24 全链路通过（打包、解包、启动、全路由） |
| 剩余障碍 | 函数运行时 Node 版本太旧，需设一个环境变量 |

## 之后的方向（按顺序执行）

1. **设环境变量**：Netlify 后台评论站点（melodic-meerkat-c2b6cb）→ Site configuration → Environment variables → 新增 `AWS_LAMBDA_JS_RUNTIME` = `nodejs24.x`，然后 Retry deploy（或推一个空提交）触发重新部署。
2. **验证服务**：请求 `https://melodic-meerkat-c2b6cb.netlify.app/.netlify/functions/comment/comment?path=%2F`，应返回 200 和 JSON（响应头带 `x-waline-version`）。
3. **若仍 502**：把响应体的 errorType / errorMessage 读出来（本次排障最快的一招就是读 502 响应体，每一层错误都在里面），按同一思路继续。
4. **启用评论**：博客仓库 `src/site.config.ts` 的 `walineServerURL` 填 `https://melodic-meerkat-c2b6cb.netlify.app/.netlify/functions/comment`，推送。
5. **线上实测**：在任意文章页发一条测试评论；管理后台在 `https://melodic-meerkat-c2b6cb.netlify.app/.netlify/functions/comment/ui`。
6. **清理**：本地调试目录（AppData/Local/Temp 下 waline 系列）可删。

## 关键资产位置

- 博客仓库：`C:\Users\shuangyun\blog`（GitHub Farvre/blog）
- 评论服务仓库：`Farvre/netlify-starter`（netlify.toml + prune.js，构建时执行 `node prune.js` 剪枝）
- MongoDB Atlas：集群 `blog`，数据库 `waline`，用户 `waline`（密码只存于 Netlify 环境变量）
- Netlify 环境变量 8 个：MONGO_HOST / MONGO_PORT / MONGO_DB / MONGO_USER / MONGO_PASSWORD / MONGO_REPLICASET / MONGO_AUTHSOURCE / MONGO_OPT_SSL

# 五、经验总结

1. **排障要有可复现的本地环境**。这次能把一团乱麻理清，靠的是在本地用 Netlify 同款打包器复现每一步：打包、解包、真实启动、逐路由验证。线上每改一次要等几分钟构建，本地只要几秒。
2. **每一层错误都要读到原文**。502 响应体里带着完整错误链，是我们最快定位问题的途径。不要看状态码猜原因。
3. **构建环境与运行环境是两个世界**。变量、Node 版本、依赖安装行为都可能不同，本地测试通过不等于线上通过，反之亦然。
4. **给旧运行时打补丁不如升级运行时**。曾考虑给 jsdom 依赖链的每个 ESM 包手写兼容空壳，评估后放弃：正确做法是锁定函数运行时版本，一行环境变量解决。
5. **依赖剪枝先测量再动手**。328MB 的依赖树里 99MB 是一个用不到的数学字体包，先量清楚谁大谁小，再决定剪谁，别猜。
6. **网络封锁要有备用通道**。git 推送被掐断时，GitHub REST API 是可靠备胎；凭据从系统凭据管理器直接传给 API，不出现在任何输出里。
7. **机密信息零外泄**。数据库密码只填进 Netlify 环境变量，全程未出现在对话、代码、提交记录中；凭据一律掩码。
8. **尊重用户的当下状态**。用户在打游戏就绝不动桌面，任务改走后台通道；任务过长要主动停下来做交接，而不是硬扛。

任务暂停不代表失败：修复代码已经全部就绪并通过本地验证，剩下的只是设一个环境变量和一次发布。交接完毕。
