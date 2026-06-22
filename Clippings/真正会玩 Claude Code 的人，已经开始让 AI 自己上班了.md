---
title: "真正会玩 Claude Code 的人，已经开始让 AI 自己上班了"
source: "https://x.com/SuisPasDaVinci/status/2055115292292886665"
author:
  - "[[@SuisPasDaVinci]]"
published: 2026-05-15
created: 2026-05-15
description: "你以为你在用 AI 编程，其实只是在聊天装好 Claude Code 的第一天，你兴奋地打开终端：你：\"帮我写个登录功能\"Claude：\"好的，这是代码...\"你：\"记得格式化一下\"Claude：\"已格式化\"你：\"跑一下测试\"Claude：\"测试通过\"一个月后，你还在重..."
tags:
  - "clippings"
---
![图像](https://pbs.twimg.com/media/HIU8Y1QX0AAM8cO?format=jpg&name=large)

## 你以为你在用 AI 编程，其实只是在聊天

装好 Claude Code 的第一天，你兴奋地打开终端：

你："帮我写个登录功能" Claude："好的，这是代码..." 你："记得格式化一下" Claude："已格式化" 你："跑一下测试" Claude："测试通过"

一个月后，你还在重复同样的对话。

**问题不在 Claude，在于你根本不知道它能自己干这些事。**

我用了半年 Claude Code，直到某天配置了第一个 Hook，才意识到：

> 之前我一直在用一个会自动驾驶的车，手动换挡。

这篇文章不教你怎么安装（网上一搜一大把），只教你**怎么让 Claude Code 从聊天工具变成自动化员工**。

## 第一部分：基础配置（但大部分人不知道）

技巧 1：自定义状态栏 - 不然你根本不知道自己烧了多少钱

**真实场景：**

我第一次用 Claude Code 写代码，聊了 3 个小时，突然：

Error: Context window exceeded

我才发现，200k tokens 已经用完了。

**问题是：** 默认状态栏啥都不显示，你根本不知道自己用了多少 Token，直到突然爆掉。

**解决方案：** 配置自定义状态栏。

\# 效果： Opus 4.7 | 📁myproject | 🔀main | █░░░░░░░░░ 12% of 200k tokens 💬 Last: "How do I configure hooks..."

**为什么重要？**

- 实时监控 Token 消耗
- 多标签页工作时不会搞混
- 知道什么时候该开新对话

**怎么配置？** 参考 [YK 的示例脚本](https://github.com/ykdojo/claude-code-tips/blob/main/scripts/context-bar.sh)

技巧 2：语音输入 - 打字的人已经输在起跑线了

**核心观点：说话比打字快 3 倍。**

我现在已经不打字了。

用语音转文字工具（macOS 用 [superwhisper](https://superwhisper.com/)），直接对着 Claude Code 说话。

**你可能会说：**

- "转录不准确怎么办？"
- "在办公室说话不尴尬吗？"
- "有错别字 Claude 能理解吗？"

**真实情况：**

我说："ExcelElanishMark advast settings" Claude 理解成："exclamation mark advanced settings"

即使转录有错别字，Claude 也能理解。

**在办公室？** 用耳机小声说，没人注意。

**为什么很多人不用？** 因为他们不知道这个功能存在。

技巧 3：拆解大问题 - Claude 不是魔法，是工具

**错误做法：**

❌ "帮我实现一个完整的用户认证系统"

然后 Claude 给你写了一堆代码，你发现：

- 密码没加密
- Token 没验证
- 测试没写

**正确做法：**

✅ "创建一个用户注册的 API endpoint" ✅ "添加 bcrypt 密码加密" ✅ "实现 JWT token 生成" ✅ "添加登录验证中间件" ✅ "写单元测试"

**为什么？**

很多人以为 AI 越强，就越能"一步到位"。

实际上，对话越长，Claude 的表现越差。就像一个熬夜三天的实习生，反应变慢，开始重复自己，忘记早期的指令。

**你的软件工程能力依然重要。**

技巧 4：终端别名 - 每天节省 100 次输入

**问题：** 每次都要输入 claude，太慢了。

**解决方案：**

\# ~/.zshrc 或 ~/.bashrc alias c='claude' alias cc='claude -c' # 继续上次对话 alias cr='claude -r' # 选择历史对话

**效果：**

\# 之前： claude -c # 现在： cc

技巧 5：AI 上下文就像牛奶 - 越新鲜越好

**核心观点：** 对话越长，Claude 的表现越差。

很多人以为上下文越长越聪明。

实际上：

- 反应变慢
- 开始重复自己
- 忘记早期的指令

**最佳实践：**

- 每个新任务开新对话
- Token 使用超过 50% 就开新对话
- 不要在一个对话里从早聊到晚

**就像牛奶，放久了会变质。**

技巧 6：获取输出的 5 种方法 - 别再手动复制了

**问题：** 想复制 Claude 的输出，但终端复制很麻烦。

**最简单的方法：**

/copy

直接复制上一条回复到剪贴板。

**其他方法：**

- pbcopy（Mac/Linux）
- 写入文件 + VS Code 打开
- 打开 URL
- GitHub Desktop

**Pro Tip：** 如果要编辑 GitHub PR 描述，先让 Claude 写到本地文件，你审查后再复制到 GitHub。

技巧 7：让 Claude 当你的 Git 助手 - 我已经懒得写 commit message 了

**核心观点：** 不要自己写 commit message，让 Claude 写。

**实战用法：**

"Review the changes and create a commit"

Claude 会：

1. 查看 git diff
2. 分析改动
3. 写一个清晰的 commit message
4. 提交

**为什么 Claude 写得更好？**

因为它会认真看每一行改动。

你不会。

**我现在已经懒得自己写 commit message 了。因为 Claude 比我写得认真。**

技巧 8：Cmd+A / Ctrl+A 是你的朋友 - Claude 访问不了的，你可以

**核心观点：** Claude 的 WebFetch 工具有限制，但你复制粘贴没有限制。

**使用场景：**

**场景 1：Reddit 帖子**

1\. 打开 Reddit 帖子 2. Cmd+A 全选 3. 粘贴到 Claude Code 4. "总结这个帖子的主要观点"

**场景 2：公司内部文档**

1\. 打开内部文档 2. Cmd+A 全选 3. 粘贴到 Claude Code 4. "根据这个文档写实现方案"

**场景 3：终端输出**

1\. 运行命令得到一堆错误 2. Cmd+A 全选终端 3. 粘贴到 Claude Code 4. "分析这个错误日志"

适用于任何 AI，不只是 Claude Code。

## 第二部分：Hooks 系统 - Claude Code 真正开始像员工的瞬间

技巧 9：什么是 Hooks？为什么它是真正的杀手锏？

**简单理解：** Hooks = 自动触发的脚本。

**举例：**

- 当 Claude 编辑文件 → 自动运行 Prettier 格式化
- 当 Claude 运行命令 → 自动记录到日志
- 当 Claude 完成任务 → 自动发送桌面通知

**我第一次配置 Hook 的时候，突然意识到：**

> 这东西已经不是 AI 聊天了。 它开始像一个真的初级员工。

**大部分人还在手动：**

"帮我格式化一下" "记得跑测试" "别动 .env"

**会玩的人：**

让 Claude 自己记住。

**很多人以为 AI 最重要的是"写代码快"。其实真正恐怖的是：它开始接管那些你每天重复 300 次、但又不得不做的脏活。**

技巧 10：自动格式化代码

还在每次都说"记得格式化"？

你其实是在当人肉中间件。

**配置：** 在 .claude/settings.json 添加：

{ "hooks": { "PostToolUse": \[ { "matcher": "Edit|Write", "hooks": \[ { "type": "command", "command": "jq -r '.tool\_input.file\_path' | xargs npx prettier --write" } \] } \] } }

**效果：**

Claude 编辑 index.js → Hook 自动运行 prettier → 代码自动格式化

你开始意识到：之前每次手动格式化，其实是在做重复劳动。

技巧 11：保护敏感文件

**创建保护脚本：**

\# .claude/hooks/protect-files.sh #!/bin/bash INPUT=$(cat) FILE\_PATH=$(echo "$INPUT" | jq -r '.tool\_input.file\_path // empty') PROTECTED\_PATTERNS=(".env" "package-lock.json" ".git/") for pattern in "${PROTECTED\_PATTERNS\[@\]}"; do if \[\[ "$FILE\_PATH" == \*"$pattern"\* \]\]; then echo "Blocked: [$FILE\_PATH](https://x.com/search?q=%24FILE_PATH&src=cashtag_click) is protected" >&2 exit 2 fi done exit 0

**注册 Hook：**

{ "hooks": { "PreToolUse": \[ { "matcher": "Edit|Write", "hooks": \[ { "type": "command", "command": "$CLAUDE\_PROJECT\_DIR/.claude/hooks/protect-files.sh" } \] } \] } }

Claude 尝试编辑 .env → Hook 阻止 → Claude 收到反馈 → Claude 调整方案。

这才是真正的自动化。

技巧 12：桌面通知

我现在已经不盯着终端了。Claude 会主动叫我。

**macOS 配置：**

{ "hooks": { "Notification": \[ { "matcher": "", "hooks": \[ { "type": "command", "command": "osascript -e 'display notification \\"Claude Code needs your attention\\" with title \\"Claude Code\\"'" } \] } \] } }

Claude 等待你输入时 → 桌面通知 → 你可以切换到其他应用工作 → 收到通知再回来。

技巧 13：自动运行测试

**配置：**

{ "hooks": { "PostToolUse": \[ { "matcher": "Edit|Write", "hooks": \[ { "type": "command", "command": "npm test" } \] } \] } }

Claude 编辑代码 → Hook 自动跑测试 → 测试失败 → Claude 看到错误 → Claude 自动修复。

你开始意识到：之前每次手动跑测试，其实是在当人肉中间件。

技巧 14：Git 操作审计

很多人直到 Git 出事故，才第一次想起来审计。

**配置：**

{ "hooks": { "PostToolUse": \[ { "matcher": "Bash", "hooks": \[ { "type": "command", "command": "jq -r '.tool\_input.command' | grep '^git' >> ~/.claude/git-audit.log" } \] } \] } }

所有 Git 操作自动记录到 ~/.claude/git-audit.log。

团队协作时追踪谁做了什么，出问题时快速定位，符合企业合规要求。

技巧 15：Prompt-based Hooks - AI 监督 AI

需要 AI 判断是否继续，而不是简单的规则？

**示例：检查任务是否完成**

{ "hooks": { "Stop": \[ { "hooks": \[ { "type": "prompt", "prompt": "Check if all tasks are complete. If not, respond with {\\"ok\\": false, \\"reason\\": \\"what remains\\"}." } \] } \] } }

Claude 说"完成了" → Hook 触发 Haiku 模型判断 → 如果没完成，返回原因 → Claude 继续工作。

这就是 AI 监督 AI 的开始。

技巧 16：Agent-based Hooks - AI 验证代码

**示例：验证测试是否通过**

{ "hooks": { "Stop": \[ { "hooks": \[ { "type": "agent", "prompt": "Run the test suite and verify all tests pass.", "timeout": 120 } \] } \] } }

Claude 说"完成了" → Hook 启动 Agent → Agent 运行测试 → Agent 检查结果 → 如果失败，返回详细错误 → Claude 修复。

**Agent Hook vs Prompt Hook：**

- Prompt Hook：单次判断
- Agent Hook：可以执行命令、读文件、验证结果

**这就是 AI 开始自动接管重复劳动的瞬间。**

## 总结：从聊天工具到自动化员工

**基础配置（技巧 1-8）：**

- 自定义状态栏
- 语音输入
- 拆解大问题
- 终端别名
- 新鲜上下文
- 获取输出
- Git 助手
- Cmd+A 复制

**自动化工作流（技巧 9-16）：**

- Hooks 概念
- 自动格式化
- 保护文件
- 桌面通知
- 自动测试
- Git 审计
- Prompt Hooks
- Agent Hooks

**现在就开始：**

不要一次性学完所有技巧。挑 3 个最适合你的，今天就用起来：

1. **如果你经常忘记 Token 用量** → 配置自定义状态栏（技巧 1）
2. **如果你打字慢** → 试试语音输入（技巧 2）
3. **如果你想自动化格式化** → 配置 Prettier Hook（技巧 10）

**一个月后，你会发现自己的工作方式已经完全不同了。**

## 资源清单

- [Claude Code 官方文档](https://code.claude.com/docs)
- [YK 的 GitHub Repo](https://github.com/ykdojo/claude-code-tips)
- [Anthropic Discord 社区](https://discord.gg/anthropic)
- Reddit: r/ClaudeAI, r/ClaudeCode

## 致谢

本文参考了 [YK 的《32 Claude Code Tips》](https://agenticcoding.substack.com/p/32-claude-code-tips-from-basics-to)和 [Anthropic 官方 Hooks 指南](https://code.claude.com/docs/en/hooks-guide)，感谢他们的分享。