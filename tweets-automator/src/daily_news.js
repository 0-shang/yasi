const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
const Parser = require('rss-parser');
const config = require('./config');

const parser = new Parser();
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const myUserId = parseInt(process.env.TELEGRAM_USER_ID, 10);

if (!botToken || !myUserId) {
  console.error("Please set TELEGRAM_BOT_TOKEN and TELEGRAM_USER_ID");
  process.exit(1);
}

const bot = new Telegraf(botToken);
const cacheFile = path.join(config.paths.tweets.base, 'daily_news_cache.json');

const defaultRssSources = {
  "科技 (Tech)": [
    "https://news.ycombinator.com/rss",
    "https://sspai.com/feed",
    "https://www.huxiu.com/rss/0.xml"
  ],
  "AI (人工智能)": [
    "https://www.mittrchina.com/rss",
    "https://juejin.cn/rss"
  ],
  "开源工具 (Open Source)": [
    "https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml",
    "https://www.producthunt.com/feed"
  ],
  "理财 (Finance)": [
    "https://www.ftchinese.com/rss/feed",
    "https://money.163.com/special/00252EQ2/wealthrss.xml"
  ],
  "社会 (Society)": [
    "http://feeds.bbci.co.uk/zhongwen/simp/rss.xml",
    "https://cn.nytimes.com/rss/"
  ],
  "民生 (Livelihood)": [
    "https://www.v2ex.com/index.xml"
  ]
};

async function main() {
  console.log('🔄 Fetching categorized daily RSS feeds...');

  try {
    let globalIndex = 1;
    let messageText = "📰 <b>今日早报全矩阵看板</b>\n\n请直接回复对应【数字序号】，我将为您生成专属推文：\n\n";
    let textToTranslate = "";
    const cacheData = {};

    for (const [category, urls] of Object.entries(defaultRssSources)) {
      let categoryItems = [];
      for (const url of urls) {
        try {
          const feed = await parser.parseURL(url);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          let recent = feed.items.filter(item => {
            if (!item.isoDate && !item.pubDate) return true;
            const d = new Date(item.isoDate || item.pubDate);
            return d > oneDayAgo;
          });
          if (recent.length === 0) recent = feed.items.slice(0, 3);
          categoryItems.push(...recent);
        } catch(e) {
          console.error(`⚠️ Failed to fetch ${url}:`, e.message);
        }
      }

      // Limit to 10 items per category
      categoryItems = categoryItems.slice(0, 10);
      
      if (categoryItems.length > 0) {
        messageText += `🔹 <b>【${category}】</b>\n`;
        categoryItems.forEach(item => {
          const num = globalIndex++;
          let snippet = item.contentSnippet || item.content || '';
          if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';
          snippet = snippet.replace(/<[^>]*>?/gm, ''); // clean HTML

          cacheData[num] = {
            category: category,
            title: item.title,
            link: item.link,
            snippet: snippet
          };
          textToTranslate += `[${num}] ${item.title}\n`;
        });
      }
    }

    if (globalIndex === 1) {
      console.log('📭 No items found across any sources.');
      return;
    }

    const { translateToChinese } = require('./ai');
    let translatedText = textToTranslate;
    try {
      console.log('Translating and polishing titles...');
      translatedText = await translateToChinese(textToTranslate);
    } catch(e) {
      console.log('Translation failed, using original', e);
    }

    // Process translated lines into map
    const translatedMap = {};
    const lines = translatedText.split('\n');
    for (const line of lines) {
      const match = line.match(/^\[(\d+)\]\s*(.*)$/);
      if (match) {
        translatedMap[match[1]] = match[2].trim();
      }
    }

    function escapeHTML(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    let finalMessage = "📰 <b>今日早报全矩阵看板</b>\n\n请直接回复【数字序号】生成推文草稿：\n\n";
    let currentCategory = "";

    for (let i = 1; i < globalIndex; i++) {
      const data = cacheData[i];
      if (data.category !== currentCategory) {
        currentCategory = data.category;
        finalMessage += `\n🔹 <b>【${currentCategory}】</b>\n`;
      }
      const finalTitle = translatedMap[i] ? translatedMap[i] : data.title;
      if (data.link) {
        finalMessage += `<b>[${i}]</b> <a href="${escapeHTML(data.link)}">${escapeHTML(finalTitle)}</a>\n\n`;
      } else {
        finalMessage += `<b>[${i}]</b> ${escapeHTML(finalTitle)}\n\n`;
      }
    }

    // Save cache
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf-8');

    // Send via Bot
    await bot.telegram.sendMessage(myUserId, finalMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
    console.log('✅ Daily news board sent and cached!');

  } catch (err) {
    console.error('Error fetching RSS:', err);
    await bot.telegram.sendMessage(myUserId, `❌ 早报获取失败: ${err.message}`);
  }
}

main().catch(console.error);
