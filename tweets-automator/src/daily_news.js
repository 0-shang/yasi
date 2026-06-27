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
  "实用资源 (Tools & Resources)": {
    limit: 30,
    urls: [
      "https://rsshub.app/reddit/r/InternetIsBeautiful/top/day",
      "https://alternativeto.net/news/feed/",
      "https://rsshub.app/github/trending/daily/any",
      "https://feeds.appinn.com/appinn/",
      "https://feeds.feedburner.com/ruanyifeng",
      "https://www.v2ex.com/feed/share.xml",
      "https://www.v2ex.com/feed/create.xml",
      "https://www.producthunt.com/feed"
    ]
  },
  "科技人工智能 (Tech & AI)": {
    limit: 10,
    urls: [
      "https://juejin.cn/rss",
      "https://www.qbitai.com/feed",
      "https://openai.com/blog/rss.xml",
      "https://sspai.com/feed",
      "https://news.ycombinator.com/rss"
    ]
  },
  "理财投资 (Finance & Investment)": {
    limit: 10,
    urls: [
      "https://xueqiu.com/hots/topic/rss",
      "https://www.moneyweek.com/rss",
      "https://www.fool.com/feeds/index.aspx"
    ]
  },
  "社会热点 (Society Trends)": {
    limit: 10,
    urls: [
      "https://rsshub.app/weibo/search/hot",
      "https://rsshub.app/zhihu/hotlist",
      "https://rsshub.app/baidu/topwords/1",
      "https://rss.shab.fun/weibo/search/hot", // backup mirror
      "https://rss.shab.fun/zhihu/hotlist" // backup mirror
    ]
  }
};

async function main() {
  console.log('🔄 Fetching categorized daily RSS feeds...');

  try {
    let globalIndex = 1;
    let messageText = "📰 <b>今日早报全矩阵看板</b>\n\n请直接回复对应【数字序号】，我将为您生成专属推文：\n\n";
    let textToTranslate = "";
    const cacheData = {};

    for (const [category, configData] of Object.entries(defaultRssSources)) {
      let categoryItems = [];
      const urls = configData.urls;
      const limit = configData.limit;
      for (const url of urls) {
        try {
          const feed = await parser.parseURL(url);
          feed.items.forEach(item => {
            let itemDate = new Date(0);
            if (item.isoDate) itemDate = new Date(item.isoDate);
            else if (item.pubDate) itemDate = new Date(item.pubDate);
            item._parsedDate = itemDate;
            categoryItems.push(item);
          });
        } catch(e) {
          console.error(`⚠️ Failed to fetch ${url}:`, e.message);
        }
      }

      // Sort by newest first and limit to exact config amount
      categoryItems.sort((a, b) => b._parsedDate - a._parsedDate);
      categoryItems = categoryItems.slice(0, limit);
      
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
    // Split message into chunks of 4000 characters to avoid Telegram limits
    const maxLen = 4000;
    for (let start = 0; start < finalMessage.length; start += maxLen) {
      let chunk = finalMessage.slice(start, start + maxLen);
      // Ensure we don't break HTML tags, though it's unlikely with just tags and links,
      // a simple approach is just send the slice. For safety, it's better to split by newlines.
    }
    
    // Better splitting by lines
    const linesMessage = finalMessage.split('\n');
    let currentChunk = '';
    for (const line of linesMessage) {
      if (currentChunk.length + line.length + 1 > maxLen) {
        await bot.telegram.sendMessage(myUserId, currentChunk, { parse_mode: 'HTML', disable_web_page_preview: true });
        currentChunk = '';
      }
      currentChunk += line + '\n';
    }
    if (currentChunk.trim().length > 0) {
      await bot.telegram.sendMessage(myUserId, currentChunk, { parse_mode: 'HTML', disable_web_page_preview: true });
    }

    console.log('✅ Daily news board sent and cached!');

  } catch (err) {
    console.error('Error fetching RSS:', err);
    await bot.telegram.sendMessage(myUserId, `❌ 早报获取失败: ${err.message}`);
  }
}

main().catch(console.error);
