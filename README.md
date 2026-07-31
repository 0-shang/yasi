# Yasi - Personal Knowledge Base & Automations

这是一个结合了 Obsidian 个人知识库和自动化发布机器人的综合项目。它的主要目标是帮助收集、整理知识，并通过自动化工具（结合 AI）将有价值的内容转化为可以分享的推文发布到社交平台上。

## 📁 目录结构与功能模块

* **`tweets-automator/`**: 核心自动化机器人目录。这是一个基于 Node.js 和 Telegram API 的机器人，它能够：
  * 定时或手动读取你的 Markdown 笔记（如 `Clippings/` 下的网页剪藏）。
  * 结合 Gemini AI，将你的长篇笔记提炼并生成适合 Twitter/X 的推文草稿。
  * 提供了一个 Telegram 交互界面供你审核、编辑并一键发布推文。
  * 详细的安装和使用指南，请参阅 [tweets-automator/README.md](tweets-automator/README.md)。
* **`tweets/`**: 机器人生成推文的状态与数据存放目录，包含 `drafts`（草稿）、`approved`（待发布）和 `published`（已发布）等状态数据。
* **`Clippings/` / `content/` / `_templates/`**: 你的 Obsidian 知识库内容，用于日常的信息剪藏、知识沉淀和灵感记录。自动化工具正是基于这些目录下的 Markdown 数据运作。

## 🚀 快速开始

如果你想启动推文自动化机器人：

1. 进入 `tweets-automator` 目录并安装依赖：
   ```bash
   cd tweets-automator
   npm install
   ```
2. 参照 `tweets-automator/README.md` 配置 `.env` 文件（需要设置 Gemini API、Twitter API 和 Telegram Bot Token）。
3. 运行你的机器人或对应的功能脚本（如 `npm run bot` 或 `npm run generate`）。

## 📝 关于

本仓库主要是用于个人知识管理与自动化信息流发布。所有的草稿均保存在本地，通过 Git 和 Obsidian 同步进行双向管理。
