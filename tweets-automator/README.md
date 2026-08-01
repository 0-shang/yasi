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
- 📚 **本地收藏文章 (Clippings) 提取**：自动读取你本地收集的好文，一键为你拆解生成 Twitter 矩阵号内容。

---

## 📖 新手完全指南 (Step-by-Step Tutorial)

跟着这篇教程，不到 10 分钟，你就能拥有一个随叫随到的超强 AI 助理！

### 步骤 1：准备你的专属知识库文件夹

1. 首先，确保你的电脑上安装了 [Node.js](https://nodejs.org/)（自带 npm 环境）。
   *如果电脑是纯净环境，你可以在终端直接用一行命令安装 Node.js：*
   - **Mac 用户**: 如果你没有安装 Homebrew（报错 command not found: brew），最稳妥的零门槛方法是直接去 [Node.js 官网](https://nodejs.org/) 下载 Mac 安装包双击安装。
     *(或者，你也可以在终端先执行一行代码安装 Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`，安装完成后再执行 `brew install node`)*
   - **Windows 用户**: `winget install OpenJS.NodeJS` (安装后需重启终端)
   - **Linux 用户**: `sudo apt update && sudo apt install nodejs npm -y`
2. 在你的电脑上新建一个文件夹，比如叫 `my-second-brain`（或者使用你现有的 Obsidian 笔记目录）。
3. 在终端中，进入这个文件夹：
   ```bash
   cd path/to/my-second-brain
   ```

### 步骤 2：获取工具 (两种方式任选其一)

#### 方式 A：NPM 全局安装 (极简模式，推荐)
直接在你的知识库文件夹中，运行以下命令（不需要手动下载代码）：

```bash
npx content-automator init
```

#### 方式 B：Git 源码克隆 (开发者模式)
如果你想自己修改代码或者二次开发，可以直接克隆开源仓库：

```bash
git clone https://github.com/0-shang/content-automator.git
cd content-automator
npm install
cp .env.example .env
```
*(注意：使用源码模式时，你需要在 `.env` 中手动配置 `WORKSPACE_PATH=你的知识库绝对路径`，并且下文所有的 `npx content-automator ...` 指令都可以用相应的 `node src/xxx.js` 替代)*

---

*无论使用哪种方式，完成后你都会得到一个 `.env` 配置文件，接下来我们需要把各种“钥匙”填进去。*

### 步骤 3：配置各种超能力 API (填写 `.env`)

用文本编辑器打开刚刚生成的 `.env` 文件，你需要获取以下 API Keys：

**🧠 1. 大模型 API (必选)**
- 你可以选择配置 **Gemini** (去 [Google AI Studio](https://aistudio.google.com/) 免费申请) 或者 **DeepSeek** (去 [DeepSeek 开放平台](https://platform.deepseek.com/) 申请)。
- 填入对应的 `GEMINI_API_KEY` 或 `DEEPSEEK_API_KEY`。

**🐦 2. Twitter/X 自动发布权限 (如需发推则必选)**
- 访问 [Twitter Developer Portal](https://developer.twitter.com/) 创建一个 App。
- ⚠️ **极其重要**：在生成 Token 前，务必进入 "User authentication settings" 将权限设置为 **Read and Write**。
- 生成并填入你的 `TWITTER_API_KEY`、`TWITTER_API_SECRET`、`TWITTER_ACCESS_TOKEN` 和 `TWITTER_ACCESS_SECRET`。

**🐙 3. GitHub 数据同步 (强烈建议)**
- 想要让机器人帮你备份草稿到云端，去 [GitHub Settings -> Developer settings -> Personal access tokens (classic)](https://github.com/settings/tokens) 申请一个带有 `repo` 权限的 Token。
- 填入 `GITHUB_PAT`。

*(如果是写公众号需要的配图，你也可以去 Pexels 申请免费 API Key 并填入 `PEXELS_API_KEY`)*

### 步骤 4：配置 Telegram 机器人控制台

这是最神奇的一步，给你的助理装上“手脚”！

1. **申请机器人**：打开手机 Telegram，搜索 `@BotFather`，发送 `/newbot`，跟着提示创建一个机器人，并复制那一长串 **Bot Token**，填入 `.env` 中的 `TELEGRAM_BOT_TOKEN`。
2. **获取你的用户 ID**：为了防止别人滥用你的机器人，你需要绑定自己的身份。在 Telegram 搜索 `@userinfobot`，点击 Start，它会回复一串数字（比如 `123456789`）。
3. 将这串数字填入 `.env` 中的 `TELEGRAM_USER_ID`。

### 步骤 5：启动你的终极助理！

所有的配置都搞定了！现在回到你的终端，运行：

```bash
npx content-automator bot
```
看到终端提示“Bot is running...” 就说明成功了！

> **💡 运行机制说明**：
> 只要在自己电脑终端敲下 `npx content-automator bot` 后，只要这台电脑不关机、终端不关闭，你在外面就可以随时用手机通过 Telegram 控制家里的电脑干活。
> **唯一限制**：如果你把家里电脑关机了，或者断网了，手机上的 Telegram 机器人就会“睡着”没有反应。如果你希望 24 小时永不宕机，才需要考虑把这个程序挂到 VPS 或者家里的树莓派上。

### 🚀 进阶：如何部署到 VPS 实现 24 小时永不宕机？

如果你购买了便宜的云服务器 (VPS) 想要 24 小时挂机，你可以选择以下两种方式之一：

#### 方案 A：使用 Docker 极速部署 (推荐 🌟)
这是最干净、最省心的部署方式，自带后台守护与环境隔离。
1. **获取代码**：
   ```bash
   git clone https://github.com/你的用户名/content-automator.git
   cd content-automator
   ```
2. **准备知识库与环境**：
   机器人需要读取你的笔记（燃料）。如果你已经在使用 GitHub、Syncthing 或 OSS 同步你的 Obsidian/Markdown 笔记，请把它们拉取/同步到 VPS 上。如果是全新开始，可以新建一个空文件夹：
   ```bash
   mkdir my-second-brain  # 或者 git clone 你的私有笔记仓库地址
   # 然后新建并填写 .env 文件，填入你的各类 API Keys
   ```
3. **一键启动**：
   ```bash
   docker-compose up -d
   ```
   *(大功告成！你的机器人已经在后台静默运行。需要看日志随时执行 `docker logs -f content-automator-bot` 即可。)*

#### 方案 B：使用 Node.js + PM2 部署
如果你更熟悉原生 Node.js 全局命令模式，只需这 3 步：
1. **环境准备**：在 VPS 终端用一行命令安装 Node.js（参考步骤 1），然后创建文件夹并初始化：
   ```bash
   mkdir my-ai-bot && cd my-ai-bot
   npx content-automator init
   ```
2. **填写密钥**：使用 `nano .env` 填好你所有的 API Keys。
3. **后台守护运行**：使用 PM2 让机器人在后台静默挂机，即使你关掉 SSH 连接它也不会掉线：
   ```bash
   npm install -g pm2
   pm2 start "npx content-automator bot" --name "my-ai-assistant"
   ```
   *(大功告成！现在你的机器人已经拥有了真正意义上的 24 小时在线“肉身”。)*

---

## 🎮 终端与手机的交互指令

### 📱 手机端 (Telegram 机器人)

打开你刚创建的 Telegram 机器人对话框，发送：
- `/start` : 唤出主控制台。你可以点击按钮在【闲聊模式】、【推文生成模式】和【微信公众号模式】之间自由切换。
- `/check` : **知识库同步检查**。机器人会自动从 GitHub 拉取最新笔记，并扫描你电脑里还没发布的草稿，供你一键发布。
- `/clippings` : **知识库好文提取**。机器人会列出你本地最新收集的文章，点击即可让 AI 自动提炼生成推文。
- `/daily` : **抓取最新早报**。提取多源 RSS 并翻译，生成每日看板。
- `/refetch`: **重新抓取特定新闻**。

### 💻 电脑端 (终端 CLI)

除了让机器人在后台跑，你平时也可以在终端里手动使用以下命令：
- `npx content-automator generate` : 立即扫描笔记并生成推文草稿
- `npx content-automator publish` : 一键发布所有已审核的草稿
- `npx content-automator daily` : 终端生成每日资讯简报
- `npx content-automator article "你的主题"` : 自动生成一篇带配图的公众号文章
- `npx content-automator clippings` : 列出本地收藏(Clippings)并在终端交互式生成推文或长文

---
> *这就是顶级极客的浪漫：在终端里敲下一行代码，从此无论身在何处，只需一部手机，就能随时随地指挥家里的大脑为你创造价值。*
