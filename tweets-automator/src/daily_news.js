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

async function main() {
  console.log('🔄 Fetching daily RSS feeds...');
  if (!config.RSS_FEED_URL) {
    console.error('❌ RSS_FEED_URL is not configured.');
    return;
  }

  try {
    const urls = config.RSS_FEED_URL.split(',').map(u => u.trim());
    let allItems = [];

    for (const url of urls) {
      if(!url) continue;
      const feed = await parser.parseURL(url);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      let recentItems = feed.items.filter(item => {
        if (!item.isoDate && !item.pubDate) return true;
        const d = new Date(item.isoDate || item.pubDate);
        return d > oneDayAgo;
      });
      // Fallback
      if (recentItems.length === 0) recentItems = feed.items.slice(0, 5);
      allItems.push(...recentItems);
    }

    // Limit to 20
    allItems = allItems.slice(0, 20);

    if (allItems.length === 0) {
      console.log('📭 No items found.');
      return;
    }

    const cacheData = {};
    let messageText = "📰 <b>今日早报聚合看板</b>\n\n请直接回复对应【数字序号】，我将为您生成专属推文：\n\n";
    let textToTranslate = "";

    allItems.forEach((item, index) => {
      const num = index + 1;
      let snippet = item.contentSnippet || item.content || '';
      if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';
      snippet = snippet.replace(/<[^>]*>?/gm, ''); // clean HTML

      cacheData[num] = {
        title: item.title,
        link: item.link,
        snippet: snippet
      };

      textToTranslate += `[${num}] ${item.title}\n`;
    });

    const { translateToChinese } = require('./ai');
    let translatedText = textToTranslate;
    try {
      console.log('Translating to Chinese...');
      translatedText = await translateToChinese(textToTranslate);
    } catch(e) {
      console.log('Translation failed, using English', e);
    }

    // Process translated lines into HTML links
    function escapeHTML(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    
    const lines = translatedText.split('\n');
    for (const line of lines) {
      const match = line.match(/^\[(\d+)\]\s*(.*)$/);
      if (match) {
        const num = match[1];
        const title = match[2].trim();
        const link = cacheData[num] ? cacheData[num].link : '';
        if (link) {
          messageText += `<b>[${num}]</b> <a href="${escapeHTML(link)}">${escapeHTML(title)}</a>\n\n`;
        } else {
          messageText += `<b>[${num}]</b> ${escapeHTML(title)}\n\n`;
        }
      } else if (line.trim() !== "") {
        messageText += escapeHTML(line) + "\n\n";
      }
    }

    // Save cache
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf-8');

    // Send via Bot
    await bot.telegram.sendMessage(myUserId, messageText, { parse_mode: 'HTML', disable_web_page_preview: true });
    console.log('✅ Daily news board sent and cached!');

  } catch (err) {
    console.error('Error fetching RSS:', err);
    await bot.telegram.sendMessage(myUserId, `❌ 早报获取失败: ${err.message}`);
  }
}

main().catch(console.error);
