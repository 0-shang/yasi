---
title: "Claude Code 小众但真好用的功能全整理（硬核向）"
source: "https://x.com/buhuaguo1/status/2054557207132529073"
author:
  - "[[@buhuaguo1]]"
published: 2026-05-12
created: 2026-05-17
description: "大多数人只用到了 Claude Code 的 30%。这篇整理的，是剩下 70% 里值得花时间了解的部分。这篇文章整理了 Claude Code 中，那些小众但是好用的命令小技巧。上手并不难，知晓了，就可以用起来。如果你是刚接触 Claude Code，你可以可以看一下这篇新手向..."
tags:
  - "clippings"
---
![图像](https://pbs.twimg.com/media/HIM4s8ub0AA_7OD?format=jpg&name=large)

> 大多数人只用到了 Claude Code 的 30%。这篇整理的，是剩下 70% 里值得花时间了解的部分。

这篇文章整理了 Claude Code 中，那些小众但是好用的命令小技巧。

上手并不难，知晓了，就可以用起来。

如果你是刚接触 Claude Code，你可以可以看一下这篇新手向的文章。

> 5月12日

**一、Skill 里的 ! 命令——让 Skill 在 Claude 读到之前先"看"现场**

这是 Skill 系统里被严重低估的一个功能。

大多数人写 Skill 是这样的：把一段固定说明写进 SKILL.md，Claude 读到了按说明执行。

但有一种写法能让 Skill 在 Claude 读到之前，先自动跑一个 shell 命令，把命令的输出注入进来。用感叹号加反引号：

```text
## 当前 Git 差异

!\`git diff HEAD\`

## 当前 PR 信息

!\`gh pr view --comments\`
!\`gh pr diff --name-only\`
```

**执行顺序是这样的：**

1. 你触发 Skill
2. Claude Code 先跑 ! 里的命令
3. 命令输出替换掉占位内容
4. Claude 拿到的是"已经填好现场信息"的 Skill 内容

它看到的不是 \` !git diff HEAD \`，而是真实的 diff 内容。

**能用来做什么：**

- 写 PR review Skill → 自动拉最新 diff、PR 评论、改动文件列表
- 写 debug Skill → 自动注入最近的日志、当前环境版本
- 写发布 Skill → 自动读取当前分支、最近提交信息

这不是 Claude 自己决定执行命令，是 Skill 加载前的预处理，区别很大。

**二、user-invocable: false——隐藏在菜单里、但 Claude 能自动用的 Skill**

写 Skill 的时候，大多数人的心智模型是：**Skill = 我手动输入 /技能名 来触发**。

但有一类 Skill 完全不需要手动触发——它应该在 Claude 判断"需要这段背景知识"的时候，自动加载进来。

在 frontmatter 里加一行：

```text
---
user-invocable: false
description: 这个项目的数据库表结构说明。Claude 分析数据相关问题时自动参考。
---
```

加了这行之后：

- / 菜单里找不到这个 Skill
- 但 Claude 在处理相关任务时，会根据 description 自动判断要不要加载它

**适合放这类内容：**

- 项目特有的业务术语解释
- 遗留系统的历史背景
- 只有 Claude 需要、用户不需要手动调用的参考资料

和它相反的是 disable-model-invocation: true——那个是"只有我能手动调，Claude 不能自动触发"。两个参数控制的维度完全不同。

**三、Skill 的** [$ARGUMENTS](https://x.com/search?q=%24ARGUMENTS&src=cashtag_click) **传参——Skill 不一定是固定的**

触发 Skill 时可以传参数，Skill 里用 [$ARGUMENTS](https://x.com/search?q=%24ARGUMENTS&src=cashtag_click) 接收：

```text
/fix-issue 123
```

Skill 内容里这样用：

```text
---
name: fix-issue
description: 修复指定的 GitHub Issue
argument-hint: <issue 编号>
---

请修复 Issue #$ARGUMENTS

步骤：
1. 先读 GitHub Issue #$ARGUMENTS 的描述
2. 找到相关代码
3. 写修复 + 写测试
```

也可以用命名参数：

```text
---
arguments: [component, from, to]
---

把 $component 从 $from 迁移到 $to
```

然后调用：

```text
/migrate-component Button React Solid
```

**为什么这比每次在对话里说更好：** 参数和流程分离——流程固定在 Skill 里，每次只换参数。不容易漏步骤，不容易说错。

**四、Skill 的 context: fork——让重任务在"隔离房间"里跑**

有些 Skill 会读大量文件、跑很长的分析，跑完主对话的上下文会被塞满。

在 frontmatter 里加两行：

```text
---
context: fork
agent: Explore
---
```

这个 Skill 被触发后，会在一个独立的子 agent 上下文里运行，**不污染主会话**。子 agent 跑完，把结果摘要汇报回来，主会话继续保持干净。

**适合的场景：**

- 分析整个代码库的依赖关系
- 大规模搜索和整理参考资料
- 做长篇 PR review

不适合的场景：需要与主对话上下文紧密结合的任务——隔离了就拿不到主会话里的信息了。

![图像](https://pbs.twimg.com/media/HIM-QuobIAA6gOu?format=jpg&name=large)

**五、Auto Memory 的 200 行限制——为什么 MEMORY.md 要写成"索引"**

Claude Code 有一个自动维护的记忆系统（Auto Memory），默认开启。它的入口文件是：

```text
~/.claude/projects/<项目>/memory/MEMORY.md
```

**关键事实：** 每次会话开始，Claude 只加载 MEMORY.md 的**前 200 行或前 25KB**，取较小的那个。

其他详细主题文件（debugging.md、architecture.md 等）**不会**在启动时全部加载，Claude 在需要时才会按需读取。

**这意味着什么：**

如果你的 MEMORY.md 写成一大段密密麻麻的记录，超过 200 行的内容一开始就不会进入上下文。

**正确写法是把 MEMORY.md 当索引用：**

```text
# 项目记忆索引

## 快速参考
- 这个项目用 pnpm，不要用 npm
- 本地测试需要先启动 Redis
- 调试入口：见 debugging.md

## 详细主题
- 架构说明：architecture.md
- 常见报错处理：debugging.md
- API 约定：api-conventions.md
```

索引短，细节放主题文件，Claude 需要时自己去读。

**六、/compact 的隐藏用法——告诉它压缩时重点留什么**

大多数人用 /compact 就是直接发，让 Claude 自己决定压缩什么。

但它支持附带说明：

```text
/compact 保留 webhook 幂等性相关的所有讨论和已修改的文件列表
```

```text
/compact 重点保留迁移计划和还没解决的测试失败
```

这样压缩后，Claude 会优先保留你指定的内容，而不是按它自己的判断取舍。

**什么时候用：** 对话很长但任务没做完，又不想开新会话从头说——在最关键的信息上加一句说明，比让它自由发挥更可靠。

**七、Hooks 的 Notification 事件——Claude 等你的时候发系统通知**

Claude Code 跑长任务时，你可能去干别的了，它跑完了在等你，你不知道。

在 ~/.claude/settings.json 里加这段（macOS）：

```text
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude Code 需要你\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

之后每次 Claude 完成任务、需要许可权确认或等待输入时，系统会弹通知。

**注意：** 第一次可能没通知，要先在 System Settings → 通知 里给 Script Editor 开权限。验证方式：先在终端单独跑一次 osascript -e 'display notification "test"' 确认权限开好了。

**八、Hooks 的 Stop 事件——让 Claude 停下前先"自查"**

这是 Hooks 里最容易被忽视、但非常实用的事件。

Claude 准备结束当前回合时，Stop 事件触发。你可以在这里加一个检查：

```text
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "回顾本轮任务。如果缺少测试、验证步骤或有未完成的 TODO，请阻止停止并告知原因。"
          }
        ]
      }
    ]
  }
}
```

**Stop hook 和普通在对话里说"做完了要检查"的区别：**

- 在对话里说：Claude"大概率"记得，但上下文长了可能漏
- Stop hook：**每次**准备停下时必然触发，不依赖 Claude 记不记得

适合用来：任务完整性检查、验收清单核对、文档完整性验证。

![图像](https://pbs.twimg.com/media/HIM_sZNaQAAJo7Q?format=jpg&name=large)

**九、Hooks 的五种 handler——不只有 shell 命令**

大多数人看到 Hooks 就想到"跑一个 shell 脚本"。但 hook handler 其实有五种：

![图像](https://pbs.twimg.com/media/HIM70B8bQAASAIF?format=png&name=large)

**五种从左到右，确定性强 → 判断力强。**

shell 做不到语义判断（"代码风格对不对"）→ 用 prompt 需要读文件 + 跑命令再判断 → 用 agent 只是发通知或写日志 → 用 command 或 http

**十、exit code 2 vs exit code 1——这个细节写错了 Hook 就失效**

在 hook 脚本里，很多人习惯用 exit 1 表示出错。**在 Claude Code 里这是错的。**

![图像](https://pbs.twimg.com/media/HIM8OiWaQAAslQN?format=png&name=large)

如果你想阻止 Claude 写某个文件，必须是：

```text
echo "禁止修改 .env 文件" >&2
exit 2
```

用 exit 1 的话，Claude 会继续执行，你的 hook 没有起到拦截作用。

**十一、PreCompact 和 PostCompact Hook——压缩前后做点什么**

这两个事件极少被提到：

- PreCompact：上下文压缩**之前**触发
- PostCompact：上下文压缩**之后**触发

**能用来做什么：**

压缩之前归档当前会话状态到文件：

```text
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$(date): 压缩触发\" >> ~/.claude/session-log.txt"
          }
        ]
      }
    ]
  }
}
```

压缩之后重新注入关键上下文：

```text
{
  "hooks": {
    "PostCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cat ~/.claude/critical-context.md"
          }
        ]
      }
    ]
  }
}
```

适合那种"有几条信息无论如何压缩都不能丢"的场景。

**十二、Skill 的 paths 字段——只在特定文件类型时自动触发**

Skill 的 frontmatter 里有一个 paths 字段，可以限制"只在操作某类文件时自动触发"：

```text
---
description: React 组件的代码审查规范
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---
```

这样 Claude 在操作 .tsx 或 .jsx 文件时，会自动加载这个 Skill 里的规范；操作其他文件时不会触发。

**为什么有用：** 不同技术栈有不同的代码规范。不用一个巨大的 CLAUDE.md 塞所有规则，而是按文件类型分发对应的 Skill。

![图像](https://pbs.twimg.com/media/HIM_x2ObQAAwPcT?format=jpg&name=large)

**十三、Skill 的 model 和 effort 字段——按任务切换模型和思考深度**

大多数人不知道可以在 Skill 的 frontmatter 里指定当这个 Skill 被触发时，临时切换模型和思考深度：

```text
---
name: security-review
description: 安全审查当前代码改动
model: opus
effort: max
---

对当前 git diff 做全面的安全审查……
```

**实际意义：**

- 日常对话用 Sonnet（快、便宜）
- 触发 /security-review 时自动切 Opus + 最深思考
- 结束后自动回到之前的设置

不用手动 /model opus 再 /effort max 再 /model sonnet 切回来了。

**十四、UserPromptSubmit Hook——在 Claude 处理前先做点事**

这个 Hook 在你发送消息之后、Claude 开始处理之前触发。

一个实用场景——每次 Claude 处理任务前，先自动把当前时间和 git 状态注入上下文：

```text
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo \"{\\\"injectedContext\\\": \\\"Current time: $(date), Git branch: $(git branch --show-current 2>/dev/null || echo 'not a git repo')\\\"}\" "
          }
        ]
      }
    ]
  }
}
```

另一个用法：用它拦截危险指令。在 Claude 处理之前，检查用户消息里有没有"删除全部"、"drop table"之类的关键词，让 Claude 先确认。

**十五、Plugin Skill 的命名空间——避免 Skill 名冲突**

如果你用了别人的 Plugin，Plugin 里的 Skill 会带命名空间：

```text
/my-plugin:review
```

而不是直接 /review，避免和你自己的 /review Skill 撞名。

**自己写 Skill 时的含义：** 个人 Skill 直接 /技能名，Plugin Skill 带前缀 /插件名:技能名。如果同名，优先级是：Enterprise 管理 > 个人 > 项目 > Plugin。

**十六、/buddy——你的终端宠物（彩蛋功能）**

2026 年 4 月 1 日，Anthropic 悄悄在 Claude Code 里藏了一只宠物。

输入 /buddy，终端里会孵出一只 ASCII 风格的小动物，陪你写代码。这不是装饰品——它有物种、稀有度、属性值，还有 AI 驱动的个性，会在你工作时冒泡说话。

**使用前提：**

- Claude Code 版本 ≥ 2.1.89
- Pro 订阅（免费用户暂不支持）
- 宠物消耗的 token **不计入你的使用量**

**全部子命令：**

```text
/buddy          第一次孵化（带孵化动画）；之后是唤出
/buddy card     查看宠物的完整属性卡：物种、稀有度、五项数值
/buddy pet      抚摸它（触发漂浮爱心动画，持续 2.5 秒）
/buddy mute     关闭气泡说话（宠物还在，只是安静了）
/buddy unmute   恢复说话
/buddy off      本次会话暂时隐藏宠物
```

直接在对话里叫它的名字，它也会根据自己的性格回应你。

**物种和稀有度系统：**

一共 18 种物种：鸭子、鹅、猫、兔子、猫头鹰、企鹅、乌龟、蜗牛、龙、章鱼、六角恐龙鱼（axolotl）、幽灵、机器人、史莱姆、仙人掌、蘑菇、胖球（chonk）、卡皮巴拉。

稀有度分 5 档，另外有 1% 概率出现闪光（Shiny）变体。

**一个值得知道的细节：** 你的物种、稀有度和属性全部由账号 ID 通过哈希算法确定性生成——同一个账号永远出同一只宠物，改本地配置没用。社区有人做了重置工具，但一旦重新登录就会恢复原来那只。

**属性值（5 项）：**

- WISDOM（智慧）
- CHAOS（混沌）
- SNARK（毒舌）
- PATIENCE（耐心）
- ENERGY（活力）

高 SNARK 的宠物会吐槽你的代码；高 PATIENCE 的会温柔鼓励你。这五项数值直接影响 AI 生成的个性和说话风格。

这是一个彩蛋，不影响任何实际功能——但如果你长期泡在终端里写东西，多一个小东西陪着确实不一样。

![图像](https://pbs.twimg.com/media/HIM-9QsaQAAWkOo?format=jpg&name=large)

**附：一张决策表——这些功能分别解决什么问题**

![图像](https://pbs.twimg.com/media/HIM9moMaAAAxZdO?format=png&name=large)

> 所有这些功能都不在 Claude Code 的"入门教程"里。

![图像](https://pbs.twimg.com/media/HIM920WagAIMp6K?format=jpg&name=large)

> 它们存在于文档的角落，发现它们需要时间——或者有人整理给你。