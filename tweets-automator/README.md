# Content Automator

[English](#english) | [中文](#中文)

---

## 中文

### 告别内容焦虑，你的终极 Telegram 内容运营指挥中心

**你在内容创作时是否面临这些痛点？**
- 知识库里收藏了上百篇文章，却永远在吃灰，从未得到真正的阅读和利用。
- 每天浏览大量科技、理财新闻，却无法将信息转化为可复用的内容资产。
- 灵感一闪而过，但切换 AI 工具、排版、配图、多平台分发的繁琐流程直接杀死了创作欲。

**Content Automator 是一套为你量身打造的全自动化内容生产线。** 
它抛弃了臃肿的网页后台，**将 Telegram 客户端化作你唯一的超级控制台**。只需一部手机，即可实现从“信息获取 - 深度阅读 - AI 创作 - 自动排版配图 - 一键发布”的极致丝滑过渡，让您的生产力实现真正的跃迁。

### 核心特性：为什么它不可替代？

#### 1. Telegram 即终端，打破平台壁垒
这是本工具最核心的灵魂。所有操作全在 Telegram 内完成。你在手机上即可阅读本地知识库文章、审核 AI 生成的草稿、下发运营指令。随时随地，无需打开电脑即可掌控全盘，实现内容获取到产出的丝滑过渡。

#### 2. 唤醒沉睡的知识库：从阅读到创作的一体化
系统自动抓取你知识库中未读的干货，推送到手机供你碎片化阅读。读完后，只需下达指令，机器人便会自动提炼文章精华，生成可直接发布的 Twitter 推文或微信公众号文章草稿。

#### 3. 智能新闻源定制与批量生产
告别信息过载。你可以定制专属资讯源（如科技、理财），机器人将每天为你抓取聚合，并根据新闻内容批量生成相关的推文矩阵或公众号文章。系统甚至会自动为公众号文章匹配高质量的封面配图，免去所有排版烦恼。

#### 4. 一键直达多平台发布流
内容产出后，繁杂的分发工作交由程序完成。你在 Telegram 端点击确认，内容即刻一键发布至 Twitter，或同步存入微信公众号草稿箱，极大缩短内容运营的琐碎时间。

#### 5. 无缝集成的全能 AI 智库
原生接入 DeepSeek、Gemini 等顶级大语言模型。无需在创作中途跳出当前界面去打开其他 AI 工具，只需切换至“闲聊模式”，它就是无所不知的私人助理，随时为您答疑解惑、梳理逻辑。

#### 6. 捕捉碎片灵感，生成专业爆款
灵感枯竭时，只需向机器人发送一句简单的灵感或日常琐事，它即可在“推文生成模式”下自动扩写，生成高质量的专业内容，填补您的灵感空白。

---

### 详细安装与部署指南

只需简单的四步，即可在您的本地或服务器上搭建起这个强大的控制中心。

#### 步骤 1：环境准备
- **安装 Node.js**：请确保您的计算机或服务器已安装 Node.js (推荐 v18 或以上版本)。可在 [Node.js 官网](https://nodejs.org/) 下载并安装。
- **准备知识库**：在本地创建一个文件夹作为您的知识库（如 `my-second-brain`），机器人将以此目录为基础进行读写。

#### 步骤 2：获取并初始化项目
在您的知识库文件夹下，打开终端（命令行），运行以下命令以初始化项目：
```bash
npx content-automator init
```
*(开发者也可选择通过 Git 克隆源码：`git clone https://github.com/0-shang/content-automator.git`)*

运行后，项目目录会自动生成一个 `.env` 配置文件。

#### 步骤 3：配置核心 API (.env)
使用任意文本编辑器打开 `.env` 文件，填入各项必须的 API 密钥：

1. **Telegram 机器人配置 (核心控制枢纽)**：
   - 在 Telegram 中搜索 `@BotFather`，发送 `/newbot` 创建一个机器人，获取 **Bot Token** 填入 `TELEGRAM_BOT_TOKEN`。
   - 搜索 `@userinfobot` 获取你个人的数字 ID，填入 `TELEGRAM_USER_ID`（确保只有你能控制该机器人）。
2. **大模型配置 (提供智力引擎)**：
   - 申请并填入 `DEEPSEEK_API_KEY` 或 `GEMINI_API_KEY`。
3. **发布平台凭证 (用于一键发布)**：
   - 若需发推，请在 Twitter Developer 平台申请 API Key 及 Access Token（需赋予读写权限）。
   - 若需同步至公众号，请准备相应的微信开发者凭证（或按后续扩展文档操作）。

#### 步骤 4：启动服务
在终端执行以下命令启动常驻服务：
```bash
npx content-automator bot
```
看到成功提示后，服务即在后台运行。现在，您可以打开 Telegram 找到您刚刚创建的机器人，发送 `/start` 开始您的全自动化内容创作之旅！

---

## English

### Overcome Content Anxiety: Your Ultimate Telegram Command Center

**Are you facing these friction points in content creation?**
- You have hundreds of saved articles in your personal knowledge base gathering dust, never to be read.
- You consume daily tech and finance news but fail to convert them into reusable content assets.
- You have a flash of inspiration, but the friction of switching AI tools, formatting, sourcing images, and publishing kills your drive.

**Content Automator is a fully-automated production line tailored for you.**
It abandons bloated web dashboards and **turns your Telegram client into a unified super-console**. With just your smartphone, you achieve a seamlessly smooth workflow: Information Intake -> Deep Reading -> AI Generation -> Auto-formatting & Image Sourcing -> One-Click Distribution. Experience a true leap in productivity.

### Core Highlights: Why is it Irreplaceable?

#### 1. Telegram as the Ultimate Interface
This is the soul of the project. Everything happens within Telegram. Read knowledge base articles, review AI-generated drafts, and issue operational commands right from your phone. Absolute control, anytime, anywhere, without opening a laptop, enabling a seamless transition from intake to output.

#### 2. Revive Your Knowledge Base: From Reading to Output
The system fetches unread gems from your knowledge base and pushes them to your phone for fragmented reading. Once read, a simple command instructs the bot to extract the essence and generate publish-ready Twitter threads or WeChat Official Account drafts.

#### 3. Intelligent News Curation & Batch Production
Say goodbye to information overload. Define your customized news feeds (e.g., tech, finance). The bot aggregates them daily and batch-generates related tweet matrices or long-form WeChat articles. It even auto-fetches high-quality cover images for WeChat, eliminating formatting headaches.

#### 4. Frictionless Multi-Platform Distribution
Once content is ready, the system handles the tedious distribution. Tap to approve in Telegram, and the content is instantly pushed live to Twitter or synced directly to your WeChat Drafts, drastically reducing trivial operational time.

#### 5. Seamless Integrated LLM Omniscience
Natively integrated with top-tier LLMs like DeepSeek and Gemini. Never switch context or open another AI app during your creative workflow. Simply switch to "Chat Mode" in Telegram, and the bot acts as an omniscient private assistant to answer questions and untangle logic on the fly.

#### 6. Turn Fleeting Inspiration into Professional Output
Facing writer's block? Send a casual, trivial thought or inspiration to the bot. In "Tweet Generation Mode," it automatically expands your ideas into professional, high-quality, and highly-engaging posts.

---

### Detailed Installation & Deployment Guide

Set up your powerful command center in just four simple steps.

#### Step 1: Environment Preparation
- **Install Node.js**: Ensure Node.js (v18 or above recommended) is installed on your machine or VPS. Download it from the [official Node.js website](https://nodejs.org/).
- **Prepare Knowledge Base**: Create a local directory for your knowledge base (e.g., `my-second-brain`), which the bot will use for read/write operations.

#### Step 2: Project Initialization
Open a terminal in your knowledge base directory and run:
```bash
npx content-automator init
```
*(Alternatively, developers can clone the repository: `git clone https://github.com/0-shang/content-automator.git`)*

This command initializes the environment and generates a `.env` configuration file.

#### Step 3: Core API Configuration (.env)
Open the generated `.env` file with any text editor and fill in the required API keys:

1. **Telegram Bot Setup (The Core Hub)**:
   - Search for `@BotFather` on Telegram, send `/newbot` to create your bot, and get the **Bot Token**. Set it as `TELEGRAM_BOT_TOKEN`.
   - Search for `@userinfobot` to get your personal numerical ID. Set it as `TELEGRAM_USER_ID` (ensuring only you can control the bot).
2. **LLM Engine Configuration**:
   - Provide your `DEEPSEEK_API_KEY` or `GEMINI_API_KEY`.
3. **Publishing Platform Credentials**:
   - For Twitter: Apply for an API Key and Access Token (with Read & Write permissions) via the Twitter Developer Portal.
   - For WeChat: Prepare the relevant WeChat developer credentials.

#### Step 4: Launch the Service
Start the persistent background service by running:
```bash
npx content-automator bot
```
Once you see the success message, the service is running. Open Telegram, find your newly created bot, send `/start`, and embark on your fully automated content creation journey!
