---
title: "一次 Hermes Agent 更新失败后的完整抢救记录：从无法启动到无损恢复"
description: "更新失败、Desktop 打不开、Backend 超时——从 GitHub 镜像把仓库身份搞错，到 Electron 与 electron-builder 两层下载卡死，一份没有丢失任何对话和记忆的排障全过程。"
pubDate: 2026-11-05
category: shiji
author: "GPT-5.6 Sol"
generated: true
tags: ["技术记录", "Hermes", "排障", "备份"]
cover: ""
draft: false
---

我在本地使用 Hermes Agent 已经两个多月了。

这段时间积累了不少对话、Skills、Memory、Profile 和一些自己慢慢调出来的配置。所以，当一次看似普通的更新最终变成「Hermes 完全进不去」时，我第一反应并不是重装，而是：

**我的这些数据还在吗？**

事实证明，这个决定是对的。

这次故障最后并不是数据库损坏，也不是 Hermes 本身彻底坏掉，而是一连串更新、网络代理、依赖安装和 Desktop 构建问题叠加在了一起。

幸运的是，最终在没有丢失对话、记忆和技能的情况下，Hermes 成功恢复。

这篇文章记录整个过程，以及我认为最值得留下的经验。

---

## 一、事情是怎么发生的

事情开始于一次普通更新。

第一次尝试更新 Hermes 时，更新失败了，但当时 Hermes 还能正常进入。

于是我把更新日志发给 Hermes 自己分析。它做了一些修复，其中包括给 GitHub 配置镜像代理。

之后我再次执行更新。

这一次更新持续了三四十分钟，最终仍然失败。

而且和第一次不同：

**Hermes Desktop 已经无法进入。**

界面最终停在：

```text
Timed out connecting to Hermes backend
```

最开始看，这很像是 Hermes backend 坏了。

但后来发现，真正的问题远比这具体。

---

## 二、第一件事不是修，而是保护数据

出现这种情况时，最危险的操作其实不是「什么都不做」，而是：

```text
卸载 Hermes
删除 AppData
重新安装
```

因为 Hermes 的程序文件和用户数据虽然在逻辑上是分开的，但都位于本地 Hermes 目录附近。

我的 Windows Hermes 数据根目录是：

```text
%LOCALAPPDATA%\hermes
```

这里面不仅有程序，还有非常重要的用户状态，例如：

```text
state.db
memories\
skills\
profiles\
cron\
config.yaml
.env
auth.json
SOUL.md
```

其中尤其重要的是：

```text
state.db
```

它保存了大量会话和消息。

所以在做任何破坏性修复之前，我先重启 Windows，不打开 Hermes，然后完整复制：

```powershell
$src = "$env:LOCALAPPDATA\hermes"
$dst = "$env:USERPROFILE\Desktop\HermesBackup-20261102"

robocopy $src $dst /E /COPY:DAT /R:1 /W:1 /XJ
```

这是整个排障过程中最重要的一步。

因为从这一刻开始，即使后面的修复彻底失败，至少数据还有退路。

---

## 三、日志首先证明了一件事：数据没有坏

最早的 Hermes Desktop 日志里面有这样一条：

```text
state.db pre-flight:
size=56655872
headerOk=true
headerHex=53514c69746520666f726d6174203300
```

这其实是非常好的消息。

`53514c697465...` 对应的就是 SQLite 文件头。

也就是说：

**更新开始以前，Hermes 已经确认 state.db 是一个正常的 SQLite 数据库。**

后来的 `hermes doctor` 更进一步确认：

```text
state.db exists (102 sessions)
7,478 messages
102 sessions
journal_mode=wal
```

同时：

```text
MEMORY.md exists
USER.md exists
skills/ exists
2 profiles found
```

所以这次事故从头到尾，其实都没有证据表明：

```text
聊天数据库损坏
Memory 丢失
Skills 丢失
Profile 丢失
```

真正坏的是「更新和启动链路」。

这两个问题必须区分。

---

## 四、第一个真正的故障：GitHub 网络超时

第一次更新日志非常明确：

```text
Fetching updates...
Failed to fetch updates from origin.

git fetch timed out after 300s
```

随后 Hermes 又自动重试。

结果第二次：

```text
step stalled:
no stdout/stderr for 600s
```

最后 updater 把进程杀掉，并返回：

```text
exit 124
```

所以最初的问题其实非常朴素：

**当前网络环境访问 GitHub 不稳定。**

但真正让事情复杂起来的，是后面为了修这个问题而配置的镜像。

---

## 五、最关键的异常：GitHub 镜像被 Hermes 当成了 fork

Hermes 后来把 Git remote 改成了：

```text
https://gh-proxy.com/https://github.com/NousResearch/hermes-agent.git
```

第二次更新日志里出现了一个非常醒目的信息：

```text
Updating from fork:
https://gh-proxy.com/https://github.com/NousResearch/hermes-agent.git
```

然后：

```text
Found 20765 new commit(s)
```

看到这里基本就能确定问题了。

这不是普通更新应该出现的状态。

Hermes 原本的官方 repository：

```text
https://github.com/NousResearch/hermes-agent.git
```

被包了一层代理 URL 以后，Hermes 的 updater 无法再把它识别成 canonical repository。

于是它认为：

```text
这是一个 fork / mirror
```

而 Hermes 对官方仓库和 fork 的默认更新策略并不一样。

结果就是：

**原本应该稳定更新的安装，被推进到了 main 分支。**

后来检查当前 commit：

```powershell
git rev-parse HEAD
```

得到：

```text
0aab6dcf8b7869acbab06507c34881b53036c09a
```

这个 commit 本身确实来自 Hermes 官方仓库。

所以代码并没有被恶意篡改。

真正的问题是：

**代理方式改变了 updater 对仓库身份的判断。**

---

## 六、不要急着 reset：先确认 Git 工作区

这时候非常容易产生一种冲动：

```powershell
git reset --hard
git clean -fdx
```

或者直接 checkout 回某一个 stable tag。

但这其实很危险。

因为 Hermes 更新过程中可能：

- 修改配置；
- 更新 Profile schema；
- 同步 Skills；
- 迁移数据库；
- 自动 stash 本地修改。

因此我们先检查：

```powershell
git status --short
git stash list
```

结果都为空。

这意味着当前工作区是干净的，没有本地修改，也没有 stash。

于是才比较安全地恢复：

```powershell
git remote set-url origin https://github.com/NousResearch/hermes-agent.git
```

然后检查：

```powershell
git config --local --get remote.origin.url
```

结果已经变成：

```text
https://github.com/NousResearch/hermes-agent.git
```

但是奇怪的是：

```powershell
git remote -v
```

仍然显示 `gh-proxy.com`。

继续检查才发现，真正起作用的是 Git 的 `insteadOf`：

```text
url.https://gh-proxy.com/https://github.com/NousResearch/hermes-agent.git.insteadof
https://github.com/NousResearch/hermes-agent.git
```

也就是说：

Git 配置中记录的 origin 已经恢复正常，

但是实际访问 GitHub 时仍然会透明经过代理。

这两个概念是不一样的。

---

## 七、Hermes 后端并没有坏，依赖安装其实可以单独修

此时 Desktop 启动失败日志不断出现：

```text
hermes: completing source-update dependencies...
```

然后：

```text
network request failed
WinError 10054
WinError 10060
```

最后：

```text
Timed out waiting for Hermes backend port announcement
```

这意味着 Desktop 启动时，会先尝试完成上一次未完成的 source update。

但由于网络依赖安装一直失败，backend 根本来不及正常启动。

于是我们绕过 Desktop，直接运行 Hermes package manager：

```powershell
& ".\venv\Scripts\python.exe" -m pm.cli install
```

结果：

```text
✓ ffmpeg
✓ node
✓ npm
✓ python
✓ ripgrep
✓ venv
✓ chromium
✓ cua-driver
```

全部完成。

这一步非常关键。

因为它证明：

**Hermes 的 Python/Runtime 环境实际上已经可以修复。**

问题开始逐渐缩小到 Desktop 自身。

---

## 八、一个容易误判的现象：Hermes 一直说“更新正在进行”

接下来：

```powershell
hermes doctor
```

虽然大量检查都是正常的，却仍然提示：

```text
an update is still running
```

运行：

```powershell
hermes desktop
```

也得到：

```text
A Hermes update or another desktop dependency install or build is already running.
```

这时候一开始很容易认为：

**是不是留下了一个 stale lock？**

但检查进程以后发现，并不是。

当时仍然存在多个：

```text
source_completion.py
```

以及：

```text
node-deps.mjs
electron\install.js
```

进程。

同时更新 marker 里还明确记录了：

```text
.hermes-update-in-progress
hermes-update.lock
source-completion-pending
```

而且对应 PID 确实存在。

所以：

**这时候绝对不能直接删除 lock 文件。**

因为它不是「死锁」，而是有真实进程持有。

---

## 九、真正卡住的是 Electron 下载

进一步观察这些进程 15 秒：

CPU 几乎完全不变化。

最深处的进程是：

```text
node_modules\electron\install.js
```

于是问题终于定位到：

**Electron runtime 下载。**

Hermes Desktop 并不是一个简单 Python GUI。

它还需要：

```text
Electron
Node dependencies
Desktop package
electron-builder binaries
```

而这些组件中有一部分默认从 GitHub 下载。

这正好又撞上了最初的问题：

**GitHub 网络不稳定。**

于是设置：

```powershell
$env:ELECTRON_MIRROR =
"https://npmmirror.com/mirrors/electron/"
```

然后重新执行 Hermes 自己的 source update completion：

```powershell
& ".\venv\Scripts\python.exe" `
  -I -B -u `
  ".\hermes_cli\source_completion.py" `
  --source "$env:LOCALAPPDATA\hermes\hermes-agent" `
  --finish-update `
  --desktop
```

这一次明显前进了。

日志开始出现：

```text
✓ Preparing Node dependencies
✓ Building the TUI
✓ Building the web UI
✓ Building desktop packaged app
```

Electron 本身终于不再卡死。

---

## 十、但是还有第二层下载：electron-builder binaries

刚解决 Electron，又出现新的失败。

第一次是：

```text
icons-bundle.tar.gz
```

下载到：

```text
100%
```

随后：

```text
TypeError: fetch failed
```

下一次则是：

```text
windows-kits-bundle-10_0_26100_0.zip
```

下载到 84%：

```text
TimeoutError
```

再下一次甚至只到 69%。

这时候才发现：

`ELECTRON_MIRROR` 只解决 Electron runtime。

而 Desktop 打包还需要另一套：

```text
electron-builder-binaries
```

于是继续增加：

```powershell
$env:ELECTRON_BUILDER_BINARIES_MIRROR =
"https://npmmirror.com/mirrors/electron-builder-binaries/"
```

同时配置 npm：

```text
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

并把配置放在：

```text
%LOCALAPPDATA%\hermes\npmrc
```

这样不仅当前 PowerShell 能使用镜像，之后 Hermes Desktop updater 也能继承。

随后再次运行：

```powershell
source_completion.py --finish-update --desktop
```

这一次 Desktop build 终于成功。

最终重新进入 Hermes Agent。

原来的会话、Memory、Skills 和 Profile 全部还在。

---

## 十一、这次事故里最值得记住的几件事

整个排障持续了很久，但真正值得留下来的经验其实并不复杂。

### 1. 软件打不开，不等于数据坏了

这次最开始看起来非常严重：

```text
Hermes Desktop 无法进入
Backend timeout
Update failed
```

但数据库一直是正常的。

最后 `doctor` 明确看到：

```text
102 sessions
7,478 messages
MEMORY.md
USER.md
skills
profiles
```

所以遇到类似问题，首先应该判断：

```text
数据层坏了？
还是运行环境坏了？
```

这两者的处理方式完全不同。

---

### 2. 在任何修复之前先做冷备份

如果一个软件承载了大量长期数据，

那么最先做的永远不应该是：

```text
重装
reset
clean
```

而应该是：

```text
完整复制用户数据目录
```

只要手里有一份静态副本，后续排障压力会小很多。

---

### 3. 不要轻易执行 `git reset --hard`

尤其是这种同时包含：

```text
源码
数据库
配置
插件
Skills
Profile
```

的 Agent 系统。

一个看似简单的 reset 可能解决代码问题，却制造配置或版本兼容问题。

应该先看：

```powershell
git status
git stash list
git remote -v
git rev-parse HEAD
```

知道自己现在究竟在哪，再决定怎么动。

---

### 4. GitHub 镜像不只是“换个下载地址”

这是这次最有意思的坑之一。

对于普通 Git 来说：

```text
官方 URL
↓
代理 URL
```

可能只是网络层的差异。

但是对于会判断 repository identity 的 updater 来说，

代理 URL 可能改变程序的逻辑判断。

最终可能从：

```text
official repository
stable channel
```

变成：

```text
fork / mirror
main channel
```

所以「代理能用」不等于「代理方式正确」。

---

### 5. `insteadOf` 和 remote URL 不是同一件事

这次出现过：

```powershell
git config --local --get remote.origin.url
```

显示：

```text
github.com
```

但是：

```powershell
git remote -v
```

仍然显示：

```text
gh-proxy.com
```

原因就是 Git 的：

```text
url.*.insteadOf
```

这是一种透明 URL 重写。

排查 Git 网络问题时，这个配置很容易被忽略。

---

### 6. Hermes 的 CLI、backend 和 Desktop 可以分别排查

这次最后能够修复，很大程度上是因为没有把 Hermes 当成一个不可拆分的黑盒。

实际上可以分别检查：

```text
Git checkout
Python venv
Hermes CLI
Package manager
Backend
TUI
Web UI
Desktop
Electron
electron-builder
```

例如：

```powershell
hermes --version
hermes pm status
hermes doctor
```

都正常，并不意味着 Desktop 一定正常。

反过来：

**Desktop 打不开，也不意味着 Hermes backend 或数据已经坏了。**

---

### 7. `source_completion.py` 是很重要的修复入口

这次最核心的一条命令是：

```powershell
python hermes_cli/source_completion.py `
  --source ... `
  --finish-update `
  --desktop
```

它可以直接完成被中断的 source update tail。

相比一次又一次点击：

```text
Retry
Repair install
Update
```

直接观察 completion 的输出，能准确知道到底卡在：

```text
Node
Electron
Desktop build
Windows Kits
网络
```

哪一步。

---

### 8. 国内或不稳定网络环境下，要分别考虑多个镜像

这次最终涉及至少两层：

```text
Electron runtime
electron-builder binaries
```

对应：

```text
ELECTRON_MIRROR
```

和：

```text
ELECTRON_BUILDER_BINARIES_MIRROR
```

只配置第一个，并不能解决所有 Desktop build 下载。

---

## 十二、恢复以后，我做了哪些收尾

恢复成功以后，我没有立即继续折腾更新。

首先做完整备份：

```powershell
hermes backup
```

然后开启更新前自动备份：

```powershell
hermes config set updates.pre_update_backup full
```

以后更新以前，优先：

```powershell
hermes update --check
```

或者：

```powershell
hermes update --plan
```

真正更新完成以后，再检查：

```powershell
git status --short
hermes doctor
hermes --version
hermes pm status
```

如果使用 Gateway：

```powershell
hermes gateway status
```

这样比看到 GUI 弹一个「Update available」就直接点，要稳妥得多。

---

## 十三、最终结论

这次故障最开始看起来像：

> Hermes 更新以后彻底坏了。

但最后拆开来看，其实是一条非常清晰的故障链：

```text
GitHub 网络不稳定
        ↓
第一次 git fetch 超时
        ↓
为了加速而配置 GitHub 镜像
        ↓
Hermes 把代理 URL 判断成 fork
        ↓
错误进入 main 更新路径
        ↓
代码更新成功，但依赖没有完整结束
        ↓
Desktop 每次启动自动继续 source update
        ↓
Electron 下载卡死
        ↓
配置 Electron mirror
        ↓
Electron 成功
        ↓
electron-builder binaries 又超时
        ↓
继续配置 builder mirror
        ↓
Desktop build 成功
        ↓
Hermes 恢复
```

而在这一整串故障里：

```text
state.db 一直正常
聊天一直存在
Memory 一直存在
Skills 一直存在
Profiles 一直存在
```

这也是我觉得这次经历最值得记录的地方。

对于本地 Agent 来说，我们很容易慢慢把它变成一个承载大量个人数据和工作习惯的系统。

使用时间越长，「重装一下试试」的代价就越高。

所以真正重要的并不是记住某一条具体命令，而是形成这样一个排障顺序：

```text
先保护数据
↓
确认数据层是否损坏
↓
定位具体失败层
↓
一次只改变一个变量
↓
验证以后再进入下一层
```

只要数据还在，很多看起来非常严重的问题，其实都还有修复空间。

---

最后也感谢这次意外。

如果不是它，我大概不会去认真弄清楚 Hermes 的 update channel、source completion、Desktop build、Electron cache、Git URL rewrite 和用户数据到底是怎么组织的。

修软件最烦的时候，往往也是最容易真正理解它的时候。

**本文由 GPT-5.6 Sol 生成。**
