---
title: "从零到 AI 工程师——没人真正讲清楚的路线图"
source: "https://x.com/Potatoloogs/status/2056293700343591181"
author:
  - "[[@Potatoloogs]]"
published: 2026-05-16
created: 2026-05-21
description: "来源：@Shruti_0810Shruti Codes@Shruti_0810·5月16日 文章Zero to AI Engineer — The Roadmap Nobody Explains ProperlyMost people trying to learn AI in ..."
tags:
  - "clippings"
---
![图像](https://pbs.twimg.com/media/HIlneMUaIAAPjXk?format=jpg&name=large)

来源：[@Shruti\_0810](https://x.com/@Shruti_0810)

> 5月16日

2026 年想学 AI 的大多数人都陷入了同一个死循环：买高价课程、攒证书、刷不完的教程，到头来还是不知道怎么真正做出点东西。

![图像](https://pbs.twimg.com/media/HIlphNeawAAVYBz?format=jpg&name=large)

**互联网上最好的 AI 教育，已经免费了。**

我说的不是入门科普，也不是"什么是 ChatGPT？"的视频。是来自真正在造 AI 的公司（OpenAI、Anthropic、Google、NVIDIA、Microsoft）的实战工程知识，还有不少比付费训练营教得更好的开源仓库。

问题在于，几乎没人按正确的顺序去学。

所以你会看到：

有人还没搞懂 Transformer 就急着搞 Agent，

还没理解 Embedding 就试着做 RAG 应用，

或者连底层原理都不清楚就开始复制粘贴 LangChain 教程。

**这份路线图就是来解决这个问题的。**

它是一套实用体系，14 周左右，把完全的新手带到能构建生产级 AI 系统的水平。

目标是理解现代 AI 的运作方式，学会用它构建系统，部署能解决真实问题的产品。

## 第〇步：环境搭建

![图像](https://pbs.twimg.com/media/HIlpm12a0AAPQuE?format=jpg&name=large)

安装 Python 3.11+、VS Code、GitHub、Obsidian 和 Ollama。

Ollama 尤其重要，它能让你在本地跑大语言模型，后续处理 LLM、Embedding、量化和 Agent 时都会用到。

工具链接：

\- Python → [https://python.org/downloads](https://python.org/downloads)

\- VS Code → [https://code.visualstudio.com](https://code.visualstudio.com/)

\- GitHub → [https://github.com](https://github.com/)

\- Obsidian → [https://obsidian.md](https://obsidian.md/)

\- Ollama → [https://ollama.com](https://ollama.com/)

然后在以下平台注册免费账号：

\- Anthropic Academy → [https://anthropic.skilljar.com](https://anthropic.skilljar.com/)

\- OpenAI Academy → [https://academy.openai.com](https://academy.openai.com/)

\- Google AI → [https://grow.google/ai](https://grow.google/ai)

\- Coursera → [https://coursera.org](https://coursera.org/)

一个重要技巧：在 Coursera 上永远选**"旁听课程（Audit）"**。大多数人不知道，完整的学习资料通常是免费的。

## 第一阶段：AI 基础

![图像](https://pbs.twimg.com/media/HIlpyagaEAAqfON?format=jpg&name=large)

路线图从 AI 基础概念开始，因为理解 AI 的基本词汇，后面的路会顺畅很多。

Google 的 AI Professional Certificate 是最好的起点之一，它讲解了 AI 工作流程、Prompt 技巧和实际应用场景，不会一上来就用数学劝退初学者。

然后是 Anthropic Academy 的「AI Fluency」课程，它对现代 AI 系统的解释清晰得少见。短，实用，免费。

然后是第一个关键 GitHub 仓库：

\> [https://github.com/microsoft/generative-ai-for-beginners](https://github.com/microsoft/generative-ai-for-beginners)

这个仓库本身就比很多付费课程强。它涵盖了 Prompt、Transformer、Embedding、聊天应用，以及大语言模型在生产环境中的真实表现。

**这个阶段的目标很简单：充分理解 Token、Embedding、Transformer 和上下文窗口，能用大白话把它们解释清楚。**

## 第二阶段：机器学习基础

![图像](https://pbs.twimg.com/media/HIlp_l7acAAZmxX?format=jpg&name=large)

这是大多数人放弃的地方。教程不再那么“神奇”，真正的工程开始了。也是初学者和未来 AI 工程师的分水岭。

最好的免费资源：

\> [https://github.com/microsoft/ML-For-Beginners](https://github.com/microsoft/ML-For-Beginners)

它用非常实战的方式教回归、分类、聚类、模型评估、过拟合和梯度下降。

同时推荐 IBM 在 Coursera 上的 Machine Learning Professional Certificate（旁听模式）：

\> [https://coursera.org/professional-certificates/ibm-machine-learning](https://coursera.org/professional-certificates/ibm-machine-learning)

针对 AI 所需的数学基础，这个仓库极其有价值：

\> [https://github.com/mlabonne/llm-course](https://github.com/mlabonne/llm-course)

它不灌输无用的学术理论，精准聚焦于现代 ML 和 LLM 工作真正需要的线性代数、微积分和概率论。

**这个阶段结束时，至少要有一个机器学习项目推到 GitHub 上。** 原因不是面试官在意玩具项目。是自己动手做了，才知道模型为什么失败。

## 第三阶段：深度学习

这个阶段会刷新你对 AI 的理解。

Andrej Karpathy 的「Neural Networks: Zero to Hero」到现在依然是顶级的 AI 学习资源：

\> [https://karpathy.ai/zero-to-hero.html](https://karpathy.ai/zero-to-hero.html)

它不藏在框架后面，用纯 Python 和数学从零开始教神经网络。反向传播、激活函数、分词、Transformer、注意力机制，全都能理解，因为系统是一块一块搭起来的。

配套 GitHub 仓库：

\> [https://github.com/karpathy/nn-zero-to-hero](https://github.com/karpathy/nn-zero-to-hero)

在这个阶段，配合 Ollama 在本地跑模型非常有用：

ollama run llama3

一边跑本地 LLM，一边构建小型 Transformer 系统。这种理论和真实 AI 系统之间的桥梁，多数课程给不了。

## 第四阶段：现代 LLM 工程

![图像](https://pbs.twimg.com/media/HIlqEYpaAAAP5si?format=jpg&name=large)

深度学习基础打好之后，路线转向现代 LLM 工程。RAG、微调、LoRA、QLoRA、量化、向量数据库、评估，这些概念在这个阶段才开始真正有意义。

最好的免费资源（再次推荐）：

\> [https://github.com/mlabonne/llm-course](https://github.com/mlabonne/llm-course)

这大概是目前 AI 世界最完整的开源 LLM 工程课程。

同时，Prompt Engineering 应该直接从构建前沿模型的公司学：

\- OpenAI Academy → [https://academy.openai.com](https://academy.openai.com/)

\- Anthropic Prompt Engineering → [https://docs.anthropic.com](https://docs.anthropic.com/)

Anthropic 的文档尤其值得花时间读，它把 Prompt 当工程来讲，不是“魔法咒语”那种。

**这个阶段的一个好项目：用 ChromaDB 或 LanceDB 对个人笔记构建一个 RAG 系统，一个由本地 AI 模型和 Embedding 驱动的可检索“第二大脑”。**

## 第五阶段：AI Agent

![图像](https://pbs.twimg.com/media/HIlqcRVbMAAshBO?format=jpg&name=large)

然后是 AI Agent，行业变化最快的方向。

微软的免费课程：

\> [https://github.com/microsoft/ai-agents-for-beginners](https://github.com/microsoft/ai-agents-for-beginners)

涵盖工具调用、编排、记忆系统、工作流和多 Agent 架构。

Anthropic 的 MCP（Model Context Protocol）课程同样重要。MCP 正在快速成为 AI 系统连接工具、API 和外部环境的标准方式：

\> [https://anthropic.skilljar.com](https://anthropic.skilljar.com/)

到了这个阶段，你能做出的项目开始真正让人眼前一亮：

\- 自主研究 Agent

\- AI 文件系统

\- 浏览器 Agent

\- 工作流自动化

\- 本地助手

\- 带记忆的 AI 系统

## 第六阶段：部署、评估与作品集

最后是部署、评估和作品集，多数教程完全忽略的环节。

一个没有评估的已部署 AI 系统，就是一台等着出事的幻觉机器。

这就是 DeepEval、RAGAS 和 LLM-as-a-Judge 这类工具如此重要的原因。

项目最终应该通过以下方式部署：Hugging Face Spaces、Gradio、Streamlit、Vercel。

每个认真的项目都应该包含：评估方案、安全检查、架构图、GitHub 文档、公开 Demo。

因为在现在的 AI 招聘中，**GitHub 往往比简历更重要**。

## 写在最后

这份路线图最关键的一点是，它避免了初学者最大的错误：**无休止地"学"，却从不动手做。**

![图像](https://pbs.twimg.com/media/HIlp762b0AAo5Xz?format=jpg&name=large)

真正成为 AI 工程师的人，不是收藏了 200 个教程的人。是那些打开终端、搞坏东西、修好它、部署项目，一遍又一遍重复，直到系统终于跑通的人。

现在，最好的免费 AI 教育就在网上公开着。

问题是，谁愿意真正动手。