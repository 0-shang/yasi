# Content Automator

[English](#english) | [中文](#中文)

---

## 中文

### 项目简介
Content Automator 是一款高级的、全自动化的 AI 内容创作助手，旨在打破个人知识管理与内容输出之间的壁垒。专为内容创作者和知识工作者设计，该工具大幅降低了内容整理、生成与分发过程中的运营摩擦，使您能够专注于核心的灵感创作。

### 设计初衷与核心功能

1. **移动端知识库随时阅读**
   解决个人知识库中大量收藏文章未能及时阅读和利用的问题。该系统能随时将未读文章抓取并推送到手机端，实现随时随地阅读。

2. **从阅读到创作的自动化转化**
   实现生产力的跃迁。在阅读知识库文章后，系统可根据文章内容自动提炼，生成可直接发布的推文或微信公众号文章草稿。

3. **定制化新闻资讯聚合**
   实现新闻资讯的高度定制化。系统支持定向抓取科技、理财等各类题材的新闻，提供专属的信息流服务。

4. **内容批量生成与自动高质量配图**
   将每日新闻高效转化为可复用的内容资产。系统支持根据新闻内容批量生产推文或公众号文章，并针对公众号文章自动匹配高质量配图，免除排版烦恼。

5. **一键多平台分发**
   极大缩短内容运营过程中的琐碎时间。系统支持一键将生成的内容直接发布至 Twitter，或同步至微信公众号草稿箱，构建无缝的发布工作流。

6. **内嵌大模型全能工作区**
   原生接入 DeepSeek 与 Gemini 等领先的大语言模型。切换至“闲聊模式”后，机器人可随时辅助解答各类问题。在创作过程中，免除在不同 AI 工具间频繁切换的时间成本。

7. **灵感捕捉与高质量推文生成**
   彻底解决内容运营者灵感枯竭的痛点。在“推文生成模式”下，仅需发送日常琐碎的灵感片段，系统即可自动扩写并生成高质量的推文内容。

### 快速开始

#### 1. 准备工作
确保系统已安装 Node.js，并在本地准备好您的知识库目录。

#### 2. 安装与配置
可通过 NPM 全局安装或克隆源码：
```bash
npx content-automator init
```
系统将自动生成 `.env` 配置文件。您需要配置以下核心参数：
- 大语言模型密钥 (GEMINI_API_KEY 或 DEEPSEEK_API_KEY)
- 社交平台开发凭证 (Twitter API 凭证等)
- Telegram 机器人控制凭证 (TELEGRAM_BOT_TOKEN 及 TELEGRAM_USER_ID)

#### 3. 启动服务
在终端执行以下命令启动常驻服务：
```bash
npx content-automator bot
```
服务启动后，您即可通过 Telegram 客户端随时进行远程交互与指令下发。

---

## English

### Introduction
Content Automator is an advanced, fully-automated AI content creation assistant designed to bridge the gap between personal knowledge management and content output. Built for content creators and knowledge workers, this tool minimizes the operational friction involved in content curation, generation, and distribution, allowing you to focus entirely on creative ideation.

### Core Capabilities & Design Intent

1. **Mobile Knowledge Accessibility**
   Solve the issue of unread articles accumulating in your personal knowledge base. The system fetches saved articles and pushes them directly to your mobile device, enabling ubiquitous reading.

2. **Automated Reading-to-Creation Workflow**
   Achieve a leap in productivity. After reading an article from your knowledge base, the assistant automatically synthesizes the information to generate publish-ready Tweets or WeChat Official Account draft articles.

3. **Customized News Curation**
   Experience highly customized news aggregation. The system fetches daily news across various designated topics, such as technology and finance, providing a tailored information feed.

4. **Batch Content Generation & High-Quality Auto-Sourcing for Media**
   Transform daily news into reusable content assets efficiently. The system batch-generates Tweets or WeChat articles based on news topics and automatically sources high-quality cover images for WeChat articles, eliminating formatting efforts.

5. **One-Click Multi-Platform Distribution**
   Drastically reduce trivial operational time. The system features one-click publishing directly to Twitter and synchronization to the WeChat Official Account draft box, constructing a seamless publishing workflow.

6. **Integrated LLM Workspace**
   Natively powered by industry-leading large language models including DeepSeek and Gemini. By switching to 'Chat Mode', the assistant answers any queries on demand, saving the context-switching time between different AI tools during the creative process.

7. **Inspiration Capture & High-Quality Tweet Generation**
   Overcome writer's block. In 'Tweet Generation Mode', you can input fragmented, trivial daily inspirations, and the system will automatically expand them into high-quality, professional Tweets.

### Quick Start

#### 1. Prerequisites
Ensure Node.js is installed on your system and your local knowledge base directory is prepared.

#### 2. Installation & Configuration
Install globally via NPM or clone the repository:
```bash
npx content-automator init
```
The system will generate a `.env` configuration file. You need to provide the following parameters:
- LLM API Keys (GEMINI_API_KEY or DEEPSEEK_API_KEY)
- Social Media Developer Credentials (e.g., Twitter API keys)
- Telegram Bot Credentials (TELEGRAM_BOT_TOKEN and TELEGRAM_USER_ID)

#### 3. Start the Service
Run the following command in your terminal to start the background service:
```bash
npx content-automator bot
```
Once started, you can remotely control and issue commands to your assistant anytime via the Telegram client.
