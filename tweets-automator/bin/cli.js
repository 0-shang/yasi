#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const command = process.argv[2];

function printHelp() {
  console.log(`
🚀 Content-Automator CLI
========================
用法: content-automator <command>

可用命令:
  init       在当前目录初始化配置文件 (.env)
  generate   扫描笔记并生成推文草稿
  publish    一键发布已通过审核的推文草稿
  bot        启动 Telegram 机器人守护进程
  daily      获取 RSS 并生成每日资讯简报
  article    <topic> 自动生成一篇带配图的微信公众号排版长文
  clippings  列出本地收藏(Clippings)并选择生成推文或长文

示例:
  content-automator init
  content-automator article "AI 将如何改变未来"
  `);
}

function initEnv() {
  const targetEnv = path.join(process.cwd(), '.env');
  const sourceEnv = path.join(__dirname, '..', '.env.example');
  
  if (fs.existsSync(targetEnv)) {
    console.log('⚠️ 当前目录已存在 .env 文件，跳过初始化。');
    return;
  }
  
  if (fs.existsSync(sourceEnv)) {
    fs.copyFileSync(sourceEnv, targetEnv);
    console.log('✅ 成功在当前目录生成 .env 文件！请打开它并填入你的 API Keys。');
  } else {
    // Fallback if .env.example doesn't exist
    const template = `GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-pro
TWITTER_API_KEY=your_key
TWITTER_API_SECRET=your_secret
TWITTER_ACCESS_TOKEN=your_token
TWITTER_ACCESS_SECRET=your_token_secret
PEXELS_API_KEY=your_pexels_key
`;
    fs.writeFileSync(targetEnv, template, 'utf-8');
    console.log('✅ 成功在当前目录生成 .env 文件！请打开它并填入你的 API Keys。');
  }
}

switch (command) {
  case 'init':
    initEnv();
    break;
  case 'generate':
    require('../src/generate');
    break;
  case 'publish':
    require('../src/publish');
    break;
  case 'bot':
    require('../src/bot');
    break;
  case 'daily':
    require('../src/daily_news');
    break;
  case 'article':
    const topic = process.argv.slice(3).join(' ');
    if (!topic) {
      console.log('❌ 请提供一个主题！\n👉 示例: content-automator article "AI将如何改变未来的工作方式"');
      process.exit(1);
    }
    // Set argv for the existing script
    process.argv[2] = topic;
    require('../generate-article.js');
    break;
  case 'clippings':
    require('../src/clippings.js');
    break;
  default:
    printHelp();
    break;
}
