# Twitter/X 自动化推文生成与发布工具

这个工具能够自动扫描你仓库中的 Markdown 笔记与网页剪藏（Clippings），识别出有价值的观点，并通过 Gemini 自动为您生成推文草稿。您可以在 Obsidian 或其他编辑器中进行审核与修改，确认后一键将其自动发布到 Twitter/X。

---

## 🏗️ 目录结构

工具运行后，会在你的仓库根目录下创建 `tweets/` 文件夹：

```text
yasi/                          (Obsidian 仓库根目录)
├── Clippings/                 (网页剪藏目录)
├── tweets/                    (推文管理目录)
│   ├── drafts/                (自动生成的推文草稿)
│   ├── approved/              (你审核通过、等待发布的推文)
│   ├── published/             (已成功发布的推文历史)
│   ├── failed/                (发布失败的推文)
│   └── state.json             (记录已被处理过的源笔记，防止重复生成)
└── tweets-automator/          (本自动化工具目录)
```

---

## 🛠️ 安装步骤

1. **安装依赖**：
   在终端中进入 `tweets-automator` 目录，并运行安装命令：
   ```bash
   cd tweets-automator
   npm install
   ```

2. **配置环境变量**：
   - 复制 `.env.example` 并重命名为 `.env`：
     ```bash
     cp .env.example .env
     ```
   - 打开 `.env` 文件，填写你的 API 密钥。

---

## 🔑 获取 API 密钥配置指南

### 1. Gemini API Key
- 前往 [Google AI Studio](https://aistudio.google.com/) 免费创建一个 API Key。
- 将 Key 填入 `.env` 中的 `GEMINI_API_KEY`。

### 2. Twitter/X API 凭证 (非常重要)
为了能让脚本代表你发布推文，你需要在 Twitter 开发者平台注册并获取权限：
1. 打开 [Twitter Developer Portal](https://developer.twitter.com/) 并使用你的 Twitter 账号登录。
2. 创建一个 **Project** 和一个 **App**（如果还没有）。
3. **设置权限（关键步骤）**：
   - 在你的 App 页面中，找到 **User authentication settings**（用户身份验证设置），点击 **Set up** 或 **Edit**。
   - 在 **App permissions** 中，选择 **Read and Write**（读与写权限，否则无法发布推文）。
   - 在 **Type of App** 中，选择 **Web App, Automated, or Bot**。
   - 在 **Callback URI / Redirect URL** 中填写 `https://localhost`（因为是本地脚本，这个地址只用于满足格式要求）。
   - 在 **Website URL** 中填写 `https://localhost`。
   - 保存设置。
4. **生成 Token**：
   - 返回 **Keys and tokens** 选项卡。
   - 重新生成（Regenerate） **Consumer Keys**（API Key 和 API Secret）。
   - 重新生成（Regenerate） **Access Token and Secret**（确保是在设置了 Read & Write 权限之后生成的！）。
5. 将这四个值分别填入 `.env` 对应的字段中。

---

## 🚀 使用工作流

### 第一步：扫描并生成草稿 (`npm run generate`)
在 `tweets-automator` 目录下运行：
```bash
npm run generate
```
* **工作原理**：脚本会自动扫描仓库里所有的 Markdown 文件（排除了系统目录和 `tweets/` 文件夹），对比 `tweets/state.json` 中的修改时间。只有**新添加**或**被修改过**的笔记才会被发送给 Gemini 2.5 Flash 模型，生成 1~3 条推文草稿，保存在 `tweets/drafts/` 目录中。

### 第二步：审核与批准 (在 Obsidian 中完成)
1. 打开 Obsidian，进入 `tweets/drafts/` 文件夹。
2. 查看生成的推文草稿，根据需要修改推文正文。
3. **如何批准发布**（支持以下两种方式之一，推荐方式 1）：
   * **方式 1（推荐）**：在 Obsidian 侧边栏中，直接将该 `.md` 文件拖拽移动到 `tweets/approved/` 文件夹中。
   * **方式 2**：编辑该草稿文件顶部的 YAML 元数据（Frontmatter），将 `status: "draft"` 改为 `status: "approved"`。

> **💡 提示（支持推文推特/Thread）**：
> 如果你想发一条**推特推文链（Thread）**，可以在推文正文中，用空行加上 `---` 分割线来分割不同的推文。例如：
> ```markdown
> ---
> source: "笔记路径.md"
> status: "draft"
> ---
> 这是推特链的第一条推文。
> 
> ---
> 
> 这是第二条回复推文。
> 
> ---
> 
> 这是第三条回复推文。
> ```
> 工具在发布时会自动将其识别并作为 Thread 链式发送。

### 第三步：一键发布到 Twitter (`npm run publish`)
在 `tweets-automator` 目录下运行：
```bash
npm run publish
```
* **工作原理**：
  - 脚本会扫描 `tweets/approved/` 文件夹中的所有文件，以及 `tweets/drafts/` 文件夹中被你标记为 `status: "approved"` 的文件。
  - 读取正文，自动调用 Twitter API 进行发布。
  - **成功发布后**：更新文件 frontmatter（添加 `status: "published"`、`tweet_id` 和推文链接），并移动到 `tweets/published/` 文件夹中进行归档。
  - **发布失败（如字数超限、网络故障）**：将错误原因记录在 frontmatter 的 `last_error` 字段中，并将文件移动到 `tweets/failed/` 文件夹。你可以修改后重新拖回 `approved/` 再次发布。
