---
title: "Vibe-Trading：开源的多智能体 AI 交易系统深度解析"
tags:
  - AI
  - trading
  - open-source
  - quant
created: 2026-06-09
---

# Vibe-Trading：开源的多智能体 AI 交易系统深度解析


---

## 一、概述

**Vibe-Trading** 是由 HKUDS 团队开发的开源个人 AI 交易代理，GitHub 上已获得 **11.4k+ Stars**，采用 MIT 协议。它允许你通过自然语言与市场数据交互，完成策略生成、回测、报告输出等一系列投研工作流。

🔗 仓库地址：https://github.com/HKUDS/Vibe-Trading

## 二、核心能力

### 1. 跨市场覆盖

支持 **A股、港美股、加密货币、期货、外汇** 五大市场，且**无需任何 API Key** 即可使用——系统自动降级到免费数据源（A 股走 mootdx TCP 直连、美股走 yfinance、加密货币走 OKX 等），这一点对国内用户尤其友好。

### 2. 77 项金融 Skills + 452 个预置 Alpha 因子

系统内置了覆盖数据采集、策略生成、分析、风控、加密货币等 8 大类的技能库。更惊艳的是 **Alpha Zoo**——包含 **452 个预置的量化因子**，来自四个大类：

| 因子库 | 数量 | 来源 |
|--------|------|------|
| Qlib158 | 158 | Microsoft Qlib（Apache-2.0） |
| Alpha101 | 101 | Kakushadze 的 101 Formulaic Alphas |
| GTJA191 | 191 | 国泰君安 191 因子 |
| Academic | 其余 | 学术界经典因子 |

所有 452 个因子**全部配有中文注释**，并提供了 `alpha list`、`alpha show`、`alpha bench`、`alpha compare` 等命令，方便快速评估和对比。

### 3. 29 套 Swarm 多智能体预设

不仅是单智能体对话，Vibe-Trading 提供 **29 套 swarm 预设**，可以组建你的"投资委员会"——包括量化分析团队、加密交易团队、风控委员会等，多个 agent 以 **DAG 有向无环图**的方式协同工作，结果实时流式输出，每个 agent 的报告持久化保存。

### 4. 7 种回测引擎 + Composite 模式

内置 7 种回测引擎，还支持 **Composite 复合模式**，可以同时跑多个回测进行对比分析。支持导出到 **TradingView** 和 **通达信**，无缝衔接已有工作流。

### 5. Shadow Account（影子账户）

这是最具想象力的功能之一——通过读取券商的交易流水，**逆向分析你的交易行为**：

- 统计指标：持仓天数、胜率、盈亏比、回撤
- 行为偏差检测：处置效应、过度交易、动量追涨、锚定效应
- 影子回测：对比"实际收益" vs "如果当时执行另一种策略会怎样"
- 导出 HTML/PDF 审计报告

相当于一个**帮你做交易复盘的个人教练**，把行为金融学落地到了实操层面。

### 6. MCP 协议深度集成

Vibe-Trading 同时支持 **MCP Server** 和 **MCP Client** 两种模式：

- **作为 Server**：将 36+ 个工具暴露给 Claude Desktop、Cursor、Windsurf 等 MCP 客户端
- **作为 Client**：自身 agent 可以调用外部 MCP 服务器的工具

这意味着你可以直接在 Claude 里操控 Vibe-Trading 的全部能力。

### 7. 券商接入

目前已支持 **10 家券商/交易所**：

| 地区 | 券商 |
|------|------|
| 美股 | IBKR、Robinhood、Tiger、Alpaca |
| 加密货币 | OKX、Binance |
| 港股/A股 | 富途 |
| 印度市场 | Dhan、Shoonya、Longbridge |

交易功能是 **opt-in** 的，有额度限制和紧急停止开关，安全方面做了充分考量。

### 8. 支持的 LLM

兼容 **12+ 家模型提供商**：

OpenRouter、OpenAI、DeepSeek、Gemini、Groq、通义千问、智谱 GLM、月之暗面 Kimi、MiniMax、小米 MIMO、Z.ai、Ollama（本地运行）

官方推荐的最佳组合：**Claude Opus/Sonnet + DeepSeek V4**（性价比之选）。也可完全本地运行（通过 Ollama），无需任何 API Key。

## 三、安装与使用

### 安装方式

```bash
# pip 安装（推荐）
pip install vibe-trading-ai

# 或者 Docker 部署
git clone https://github.com/HKUDS/Vibe-Trading.git
cd Vibe-Trading
docker compose up --build
# 访问 http://localhost:8899
```

### 快速上手

```bash
# 初始化
vibe-trading init

# 运行一个策略回测
vibe-trading run -p "回测 BTC-USDT 20/50 均线策略在 2024 年的表现，总结收益率和回撤"

# 启动 Web 界面
vibe-trading serve --port 8899
```

### 接入 Claude Desktop（MCP）

在 Claude Desktop 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "vibe-trading": {
      "command": "vibe-trading-mcp"
    }
  }
}
```

## 四、架构一览

项目分为两大模块：

- **后端（Python）**：CLI、FastAPI Web 服务器、MCP 服务器、Agent 核心、持久化记忆、31 个自动发现的工具、452 个 Alpha 因子、77 个 Skills、29 个 Swarm 预设、7 种回测引擎 + Composite
- **前端（React 19 + Vite + TypeScript）**：Home、Agent、AlphaZoo、RunDetail、Compare、Correlation、Settings 等页面

数据流：自然语言 → LLM → 工具选择 → 市场数据加载 → 策略生成 → 回测引擎 → 报告 → 持久化记忆

## 五、亮点总结

1. **All-in-one 平台**：LLM 驱动的研究、策略生成、回测、Alpha 因子库、多智能体 swarm、券商接入，全在一个代码库里，CLI / Web UI / REST API / MCP 四种交互方式

2. **免费数据优先**：所有市场无需 API Key，自动降级到免费数据源

3. **Shadow Account**：从券商流水逆向分析交易行为，帮助发现自己的认知偏差

4. **MCP 原生支持**：双向集成，既是 MCP Server 也是 MCP Client

5. **452 个预置量化因子**：覆盖学术界和业界经典因子，且全中文注释

6. **LLM 无关**：支持 12+ 模型提供商，可完全本地运行

## 六、我的看法

Vibe-Trading 的 **Alpha Zoo + Shadow Account** 组合是最亮眼的部分。452 个量化因子让策略研发有了坚实的起点，不必从零开始造轮子；而 Shadow Account 把行为金融学落地到了个人交易复盘场景，这是许多付费工具都没有的功能。

作为一个完全开源的项目（MIT 协议），它在功能丰富度上已经超过了大量商业产品。如果你有 Python 基础，对量化交易感兴趣，这绝对是当前最值得关注的开源交易项目之一。

---

*本文基于 2026 年 6 月 9 日的信息整理，工具仍在快速迭代中，建议以官方文档为准。*
