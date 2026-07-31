# 🚀 Content-Automator: 你的全栈私人 AI 助理

这是一个完全私有化的个人 AI 助理。它不依赖任何臃肿的平台，直接运行在你的本地电脑上，处理你的本地 Markdown 笔记知识库，最牛的是——**它完全通过 Telegram 让你在手机上远程指挥，并支持全自动 GitHub 同步！**

**核心哲学**：数据在自己电脑上最安全，交互在 Telegram 上最方便，版本由 GitHub 最靠谱。

---

## 🌟 为什么它如此特别？（核心亮点）

市面上的工具都需要你打开网页或敲终端，但这个项目，**Telegram 就是你的终极控制台**。
只要在电脑上挂起它，你就可以在手机上享受这些带“专属按钮”的功能：

- 📱 **纯手机端操控**：不需要看电脑屏幕。你在手机发一句灵感，电脑自动帮你重写为推文草稿，手机上会直接弹出【🚀 发布】【🧵 转为 Thread】【✏️ 修改】的快捷按钮！
- 🐙 **无缝 GitHub 同步**：你在手机上生成的草稿、发布的推文，机器人会自动在你的电脑上执行 `git commit` 和 `git push`，把你的知识库完美同步到云端。
- 📝 **微信排版长文一键生成**：发个主题给机器人，它自动拉取 Pexels 高清配图，生成排版精美的长文，甚至能通过按钮直接同步到你的博客。
- 📰 **每日热点新闻策展**：在 Telegram 发送 `/daily`，它会抓取 RSS 资讯，生成带序号的早报看板。你回复序号，它就自动帮你写出犀利的锐评推文。

---

## 🛠️ 快速开始：安装与初始化

1. **进入你想让助理工作的知识库文件夹**（例如你的 Obsidian 笔记根目录）：
   ```bash
   cd /path/to/your/notes
   ```

2. **初始化环境配置**：
   无需下载复杂的代码，只要你的电脑安装了 Node.js，直接运行：
   ```bash
   npx content-automator init
   ```
   *此时，当前目录下会自动生成一个 `.env` 文件。*

3. **填入 API Keys 与 GitHub 凭证**：
   用任何文本编辑器打开 `.env` 文件，填入你需要的 API 密钥（下面有详细的获取指南）。
   **注意：如果你需要机器人帮你自动同步知识库，请务必在 `.env` 中配置 `GITHUB_PAT` (Personal Access Token)。**

---

## 📱 让机器人长出“手脚”：配置 Telegram 联动

想在手机上拥有那些酷炫的操控按钮？你需要做一次简单的“认主仪式”：
1. 打开手机 Telegram，在顶部的搜索框搜索 `@BotFather`（带有蓝 V 认证的官方机器人之父）。
2. 发送指令 `/newbot`。
3. 跟着提示给你的专属机器人起个名字（例如 `My_AI_Assistant`）。
4. 创建成功后，BotFather 会发给你一段长长的 **Bot Token**（类似 `123456789:ABCDefghIJKLmnopqrSTUvwxyz`）。
5. 将这串 Token 复制，填入你电脑里 `.env` 文件的 `TELEGRAM_BOT_TOKEN=` 处。
6. 回到终端，运行以下命令启动守护进程：
   ```bash
   npx content-automator bot
   ```
   
**大功告成！** 现在，在手机上找到你刚建的机器人发送 `/start`。你会看到一个华丽的内联键盘（Inline Keyboard）弹出。从今天起，你只需要按手机上的按钮，就能隔空操控家里的电脑帮你干活了！

---

## 🎮 Telegram 交互指南（常用指令）

你的机器人已经内置了极其丰富的对话框 UI 按钮，你可以尝试发送以下指令：

- `/start` : 唤出主控制台。你可以点击按钮在【闲聊模式】、【推文生成模式】和【微信公众号模式】之间自由切换。
- `/check` : **知识库同步检查**。机器人会自动从 GitHub 拉取最新笔记，并扫描你电脑里还没发布的草稿。并在手机上弹出列表，你可以点击每一篇草稿查看预览，并通过按钮一键发布。
- `/daily` : **抓取最新早报**。机器人将在后台提取多源 RSS 并翻译，生成每日看板。
- `/refetch`: **重新抓取特定新闻**。如果你对早报不满意，可以指定重新抓取【科技AI】或【理财投资】等领域。

---

## 🔑 其他必备 API 获取指南

### 1. 🐦 获取 Twitter/X 自动发布权限
为了让助理帮你自动发推：
1. 访问 [Twitter Developer Portal](https://developer.twitter.com/)。
2. 找到你的 App 的 **User authentication settings**，设置为 **Read and Write**（读与写权限）。
3. 生成 API Key, Secret, Access Token, Access Secret，填入 `.env`。

### 2. 🖼️ 获取 Pexels 免版权图片权限 (写公众号必备)
1. 前往 [Pexels API 官网](https://www.pexels.com/api/) 申请免费的 API Key。
2. 填入 `.env` 中的 `PEXELS_API_KEY=`。

### 3. 🧠 大模型配置
前往 Google AI Studio 获取 `GEMINI_API_KEY`，或前往 DeepSeek 平台获取 `DEEPSEEK_API_KEY`。

---
> *这就是顶级极客的浪漫：在终端里敲下一行代码，从此无论身在何处，只需一部手机，就能随时随地指挥家里的大脑为你创造价值。*
