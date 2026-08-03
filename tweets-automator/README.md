# Content Automator (灵感发散 Agent)

[English](#english) | [中文](#中文)

---

## 中文

### 告别内容焦虑，你的终极 Telegram 内容运营指挥中心

**你在内容创作时是否面临这些痛点？**
- Obsidian 知识库里收藏了上百篇文章，却永远在吃灰，从未得到真正的阅读和利用。
- 每天浏览大量科技、理财新闻，却无法将信息转化为可复用的内容资产。
- 灵感一闪而过，但切换 AI 工具、排版、配图、多平台分发的繁琐流程直接杀死了创作欲。

**Content Automator 是一套为你量身打造的全自动化内容生产线。** 
它抛弃了臃肿的网页后台，**将 Telegram 客户端化作你唯一的超级控制台**。只需一部手机，即可实现从“信息获取 - 深度阅读 - AI 创作 - 自动排版配图 - 一键发布”的极致丝滑过渡，让您的生产力实现真正的跃迁。

### 核心特性：为什么它不可替代？

#### 1. Telegram 即终端，打破平台壁垒
这是本工具最核心的灵魂。所有操作全在 Telegram 内完成。你在手机上即可阅读本地 Obsidian 知识库文章、审核 AI 生成的草稿、下发运营指令。随时随地，无需打开电脑即可掌控全盘，实现内容获取到产出的丝滑过渡。

#### 2. 唤醒沉睡的 Obsidian 知识库：从阅读到创作的一体化
系统自动抓取你 Obsidian 知识库中未读的干货，推送到手机供你碎片化阅读。读完后，只需下达指令，机器人便会自动提炼文章精华，生成可直接发布的高质量推文（Twitter/X）或排版精美的微信公众号长文草稿。

#### 3. 智能新闻源定制与批量生产
告别信息过载。你可以定制专属资讯源（如科技、理财），机器人将每天为你抓取聚合，并根据新闻内容批量生成相关的推文矩阵或公众号文章。系统甚至会自动为公众号文章匹配高质量的封面配图，免去所有排版烦恼。

#### 4. 一键直达多平台发布流
内容产出后，繁杂的分发工作交由程序完成。你在 Telegram 端点击确认，内容即刻一键发布至 Twitter，或同步存入微信公众号草稿箱，极大缩短内容运营的琐碎时间。

#### 5. 无缝集成的全能 AI 智库
原生接入 DeepSeek、Gemini 等顶级大语言模型。无需在创作中途跳出当前界面去打开其他 AI 工具，只需切换至“闲聊模式”，它就是无所不知的私人助理，随时为您答疑解惑、梳理逻辑。

#### 6. 捕捉碎片灵感，生成专业爆款
灵感枯竭时，只需向机器人发送一句简单的灵感或日常琐事，它即可在“推文生成模式”下自动发散扩写，生成高质量的专业内容，填补您的灵感空白。

---

### 与传统 Agent 的降维差异：为什么它与众不同？

市面上有许多知识库 Agent（如结合 RAG 的 Codex、Notion AI、Obsidian Copilot 等），但它们大多是**“被动检索型”**和**“向内整理型”**的工具。本工具则在以下四个维度实现了降维打击：

1. **交互形态的降维（Mobile-First）**：
   传统 Agent 需要您坐在电脑前打开重型软件。而本工具把庞大的知识库变成了您随时可以聊天的 **Telegram 好友**。无需电脑，在通勤路上用手机即可审阅、交互、发散灵感。
2. **目标的降维（Output-Driven）**：
   传统 Agent 帮您向内“收纳”知识，而本工具是**以输出和创作为唯一目的**的流水线。它负责把您发霉的知识提炼、包装成高互动率的推特文案或长图文“卖”出去，是您个人 IP 的自动化代工工厂。
3. **工作模式的降维（Proactive Daemon）**：
   传统 Agent 像图书管理员，您不问它不答。本工具则是后台 7x24 小时运行的守护进程，主动抓取 40+ 个 RSS 全网早报，主动推送您没看过的干货，把“找信息”变成了“信息找您”。
4. **链路的闭环（End-to-End Pipeline）**：
   传统 Agent 生成的内容只能留在本地。本工具打通了从私域知识库到公域平台（Twitter/微信公众号）的最后一步。机器人在 Telegram 里发送草稿，您只需点击 `一键发布`，它甚至能自动抓取配图并完成发布，是一个自带发布权的超级管理员。

---

### 全景功能指南：面面俱到的操作手册

为了让你的工作流高效运转，本工具提供了一套极其丰富的交互指令。无论是在手机 Telegram 还是电脑终端，你都能掌控一切。

#### Telegram 移动端核心指令 (你的掌上控制中心)

- **模式切换**
  - `/chat` 或点击【闲聊模式】：机器人化身全知导师。此时发给它的内容不会被自动生成推文，而是像正常的大语言模型一样回答你的任何问题。
  - `/tweet` 或点击【推文模式】：**默认状态**。你发给它的任何碎片灵感、日常吐槽，都会被自动扩写并润色成一条专业、高互动率的 Twitter/X推文草稿。
  - `/mp` 或点击【公众号模式】：你只需发给它一个简短的主题（如“AI将如何取代初级程序员”），它会自动生成一篇数千字的深度图文，并自动在互联网上寻找高质量封面图。

- **资讯与灵感捕获**
  - `/daily`：呼叫后台引擎，抓取全网最新资讯（科技、工具、理财、社会等多源早报），进行 AI 筛选与翻译，并在本地缓存。
  - `/news`：调出刚刚缓存的早报看板。你只需回复新闻对应的【数字序号】，机器人就会针对这条新闻自动为你生成辣评推文。
  - `/refetch`：当你对当前的早报不满意时，可按特定分类（仅重抓科技、仅重抓理财等）重新拉取新鲜资讯。

- **审核与一键分发**
  - `/check`：扫描 Obsidian 的草稿文件夹。它会列出所有待发布的推文，你可以直接在 Telegram 里点击预览。
  - **行内操作按钮**：在 `/check` 或生成推文时，你可以直接点击按钮：`一键发布`（直达 Twitter）、`转为 Thread`、`修改内容`、`删除草稿`。

#### 本地终端 CLI 核心功能 (开发与极客专属)

除了手机端，你在本地 Obsidian 知识库的终端里也可以敲击命令使用高级功能：
- `npx content-automator clippings`：自动扫描你本地的 `Clippings` 文件夹，列出你收藏的文章，让 AI 帮你总结并直接转化为推文或公众号文章。
- `npx content-automator article "你的主题"`：在终端一键触发公众号长文创作，图文并茂，直接输出到你的本地文件夹。
- `npx content-automator publish`：本地一键清空草稿箱，批量发布所有已审核内容。
- `npx content-automator daily`：手动在本地触发全网早报的抓取任务。

---

### 高级配置：如何设定你海量的 RSS 源？

本工具在设计上为你准备了一个庞大的**“全网早报矩阵”**。当你使用 `/daily` 抓取新闻时，程序实际上会并发请求超过数十个全球顶级的资讯源！

- 默认内置了 7 大板块（科技人工智能、理财投资、社会民生、个人成长、推文脑洞、体育产业等），包含了量子位、TechCrunch、雪球、V2EX、Reddit 热门等 40 余个源（每个板块 6-10 个源）。
- **如何修改或添加？**
  如果你想定制自己的矩阵，请直接打开源码中的 **`src/daily_news.js`** 文件。
  在文件约第 40 行，你会看到 `defaultRssSources` 对象。这是一个结构清晰的 JSON，你可以随心所欲地：
  - 增删改查你喜欢的 RSS 链接。
  - 为每个源设定抓取配额（`quota`）。
  - 自定义源的标签（`label`）。

---

### 安装与部署指南

#### 步骤 1：定位 Obsidian 知识库
找到你本地现有的 Obsidian 知识库文件夹（Vault 根目录）。我们将把这个 Agent 直接“安装”到你的知识库中。

#### 步骤 2：注入 Agent 并初始化
为了保持 Obsidian 的整洁，我们需要在知识库内部为这个 Agent 创建一个专属的“小房间”。

在你的 Obsidian 知识库根目录下，打开终端（命令行），运行以下命令来创建文件夹并进入：
```bash
mkdir content-automator
cd content-automator
```
接着，在 `content-automator` 文件夹内运行初始化命令：
```bash
npx content-automator init
```
*(开发者也可选择通过 Git 克隆源码：`git clone https://github.com/0-shang/content-automator.git`)*

运行后，项目目录会自动生成一个 `.env` 配置文件。由于我们在子目录中，默认配置中的路径 `../` 将完美指向你的 Obsidian 知识库根目录！

#### 步骤 3：配置核心 API (.env)
打开刚生成的 `.env` 文件，填入各项必须的 API 密钥：
1. **Telegram 机器人配置**：
   - 获取 **Bot Token** 填入 `TELEGRAM_BOT_TOKEN`。
   - 获取个人数字 ID 填入 `TELEGRAM_USER_ID`。
2. **大模型配置**：
   - 填入 `DEEPSEEK_API_KEY` 或 `GEMINI_API_KEY`。
3. **发布平台凭证**：
   - 若需发推，请申请 Twitter Developer API Key。

#### 步骤 4：启动服务
在终端执行以下命令启动常驻服务：
```bash
npx content-automator bot
```
看到成功提示后，服务即在后台运行。现在，您可以打开 Telegram 找到您刚刚创建的机器人，发送 `/start` 开始您的全自动化内容创作之旅！

---
---

## English

### Escape Content Anxiety: Your Ultimate Telegram Command Center

**Are you facing these friction points in content creation?**
- Hundreds of saved articles in your Obsidian knowledge base gather dust, never to be read.
- Browsing massive amounts of tech and finance news daily but failing to convert them into reusable assets.
- Friction from switching between AI tools, formatting, sourcing images, and publishing kills your creative drive.

**Content Automator is a fully-automated production line tailored for you.**
It abandons bloated web dashboards and **turns your Telegram client into your sole super-console**. Achieve a seamlessly smooth workflow from "Information Intake -> Deep Reading -> AI Generation -> Auto-formatting & Image Sourcing -> One-Click Distribution".

### Core Highlights

#### 1. Telegram as the Ultimate Interface
Everything happens within Telegram. Read your Obsidian articles, review AI-generated drafts, and issue operational commands right from your phone.

#### 2. Revive Your Obsidian Knowledge Base
The system fetches unread gems from your Obsidian vault and pushes them to your phone for fragmented reading. Once read, a simple command instructs the bot to extract the essence and generate publish-ready Twitter threads or WeChat Official Account drafts.

#### 3. Intelligent News Curation & Batch Production
Define your customized news feeds (e.g., tech, finance). The bot aggregates them daily and batch-generates related tweet matrices or long-form WeChat articles, even auto-fetching high-quality cover images.

#### 4. Frictionless Multi-Platform Distribution
Tap to approve in Telegram, and the content is instantly pushed live to Twitter or synced directly to your WeChat Drafts.

#### 5. Seamless Integrated LLM
Natively integrated with top-tier LLMs like DeepSeek and Gemini. Switch to "Chat Mode" in Telegram to use the bot as an omniscient private assistant.

#### 6. Turn Fleeting Inspiration into Professional Output
Send a casual thought to the bot, and it automatically diverges and expands it into professional, high-quality, and highly-engaging posts.

---

### Comprehensive Feature Guide

#### Telegram Core Commands
- **Mode Switching**
  - `/chat`: Agent acts as an omniscient mentor. It won't auto-generate tweets.
  - `/tweet` (**Default**): Send any fleeting thought, and the bot will auto-expand it into a highly-engaging Twitter/X draft.
  - `/mp` (WeChat Article Mode): Send a short topic, and it will generate a deep-dive long-form article with auto-sourced cover images.

- **Inspiration Intake**
  - `/daily`: Fetch and translate the latest daily news (Tech, Finance, etc.) across the web.
  - `/news`: Pull up the cached news board. Just reply with the corresponding number of the news to auto-generate a tweet.
  - `/refetch`: Re-fetch daily news by specific categories (e.g., Tech only, Finance only).

- **Review & One-Click Distribution**
  - `/check`: Scans your Obsidian's `drafts` folder. Preview pending tweets directly in Telegram.
  - **Inline Buttons**: Click inline buttons to `Publish Instantly`, `Convert to Thread`, `Edit Content`, or `Delete`.

#### Local CLI Core Features
- `npx content-automator clippings`: Scans your local `Clippings` folder and lets the AI summarize articles to generate tweets or long-form posts.
- `npx content-automator article "Your Topic"`: Triggers long-form article generation straight from the terminal.
- `npx content-automator publish`: Batch-publishes all approved drafts in your local folder.
- `npx content-automator daily`: Manually triggers the daily news fetch script locally.

---

### Advanced: Configuring Your Massive RSS Matrices

When you trigger `/daily`, the bot concurrently fetches from dozens of top-tier global sources!
- By default, it features 7 major categories (Tech/AI, Finance, Society, Personal Growth, Tweets/Ideas, Sports Industry, etc.), encompassing over 40 sources like TechCrunch, Reddit Top, and more.
- **How to customize this matrix?**
  Open the source code file **`src/daily_news.js`**. Around line 40, you will find the `defaultRssSources` object. You can freely edit this JSON structure to add/remove RSS URLs and set fetch quotas.

---

### Installation & Deployment Guide

#### Step 1: Locate Obsidian Knowledge Base
Find your existing local Obsidian vault root directory. We will "install" this Agent directly into your knowledge base.

#### Step 2: Inject the Agent and Initialize
Open a terminal in your Obsidian vault root directory and run the following commands:
```bash
mkdir content-automator
cd content-automator
```
Then, initialize the Agent:
```bash
npx content-automator init
```

#### Step 3: Core API Configuration (.env)
Open the generated `.env` file and fill in the required API keys (Telegram Token, AI Engine keys, Twitter API keys, etc.).

#### Step 4: Launch the Service
Run the following command to start the persistent background daemon:
```bash
npx content-automator bot
```
Open Telegram, find your bot, send `/start`, and embark on your fully automated content creation journey!
