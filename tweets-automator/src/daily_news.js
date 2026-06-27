const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
const Parser = require('rss-parser');
const config = require('./config');

const parser = new Parser({ timeout: 10000 });
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const myUserId = parseInt(process.env.TELEGRAM_USER_ID, 10);

if (!botToken || !myUserId) {
  console.error("Please set TELEGRAM_BOT_TOKEN and TELEGRAM_USER_ID");
  process.exit(1);
}

const bot = new Telegraf(botToken);
const cacheFile = path.join(config.paths.tweets.base, 'daily_news_cache.json');

// ============================================================
// RSS 信息源配置
// 严格按照: 实用工具30条 + 科技AI10条 + 理财10条 + 社会民生10条 = 60条
// 每个分类的 sources 按优先级排列，自动补位
// ============================================================
const defaultRssSources = {
  "实用工具资源 (Tools & Resources)": {
    limit: 30,
    sources: [
      { url: "https://rsshub.rssforever.com/github/trending/daily/any", quota: 10 }, // GitHub Trending 主
      { url: "https://rsshub.app/github/trending/daily/any",            quota: 10 }, // GitHub Trending 备
      { url: "https://feeds.appinn.com/appinn/",                        quota: 5  }, // 小众软件
      { url: "https://alternativeto.net/news/feed/",                    quota: 5  }, // 大厂平替工具
      { url: "https://www.producthunt.com/feed",                        quota: 5  }, // Product Hunt
      { url: "https://rsshub.rssforever.com/reddit/r/InternetIsBeautiful/top/day", quota: 5 }, // Reddit神奇网站
      { url: "https://www.v2ex.com/feed/share.xml",                     quota: 3  }, // V2EX分享
      { url: "https://www.v2ex.com/feed/create.xml",                    quota: 3  }, // V2EX创造
    ]
  },
  "科技人工智能 (Tech & AI)": {
    limit: 10,
    sources: [
      { url: "https://feeds.feedburner.com/ruanyifeng",  quota: 3 }, // 阮一峰网络日志
      { url: "https://www.qbitai.com/feed",              quota: 3 }, // 量子位
      { url: "https://sspai.com/feed",                   quota: 3 }, // 少数派
      { url: "https://openai.com/blog/rss.xml",          quota: 2 }, // OpenAI 博客
      { url: "https://news.ycombinator.com/rss",         quota: 3 }, // HackerNews 备用补位
      { url: "https://juejin.cn/rss",                    quota: 3 }, // 掘金 备用补位
    ]
  },
  "理财投资 (Finance & Investment)": {
    limit: 10,
    sources: [
      { url: "https://xueqiu.com/hots/topic/rss",           quota: 5 }, // 雪球热帖
      { url: "https://www.fool.com/feeds/index.aspx",        quota: 4 }, // Motley Fool
      { url: "https://www.moneyweek.com/rss",                quota: 4 }, // MoneyWeek
      { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",quota: 3 }, // 华尔街日报市场 备用
    ]
  },
  "社会民生 (Society & Life)": {
    limit: 10,
    sources: [
      { url: "http://news.163.com/special/00011K6L/rss_newstop.xml",               quota: 5 }, // 网易头条 (原生RSS,最稳定)
      { url: "https://feeds.bbci.co.uk/zhongwen/simp/rss.xml",                    quota: 4 }, // BBC中文
      { url: "https://www.zaobao.com.sg/rss/china",                               quota: 4 }, // 联合早报中国版
      { url: "https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_cchinalocal.xml",quota: 3 }, // RTHK
      { url: "https://rsshub.rssforever.com/weibo/search/hot",                    quota: 4 }, // 微博热搜 备用
    ]
  }
};

// 对单个分类执行抓取，若某源失败则自动跳过并让后续源补位，直到达到 limit
async function fetchCategoryItems(sources, limit) {
  const collected = [];

  for (const source of sources) {
    if (collected.length >= limit) break;
    const stillNeed = limit - collected.length;
    const fetchQuota = Math.min(source.quota, stillNeed);

    try {
      const feed = await parser.parseURL(source.url);
      let items = feed.items.map(item => {
        let d = new Date(0);
        if (item.isoDate) d = new Date(item.isoDate);
        else if (item.pubDate) d = new Date(item.pubDate);
        item._parsedDate = d;
        return item;
      });
      items.sort((a, b) => b._parsedDate - a._parsedDate);
      const toAdd = items.slice(0, fetchQuota);
      collected.push(...toAdd);
      console.log(`  ✅ [${toAdd.length}/${fetchQuota}] ${source.url.slice(0, 70)}`);
    } catch(e) {
      console.error(`  ⚠️ FAILED: ${source.url.slice(0, 70)} — ${e.message}`);
      // 失败时不打断循环，继续尝试下一个源补位
    }
  }

  return collected.slice(0, limit);
}

async function main() {
  console.log('🔄 Starting strict 60-item daily news fetch (30+10+10+10)...');

  try {
    let globalIndex = 1;
    let textToTranslate = "";
    const cacheData = {};
    let totalFetched = 0;

    // 先建立 finalMessage 框架，后面填入内容
    const categoryResults = {};

    for (const [category, configData] of Object.entries(defaultRssSources)) {
      const { sources, limit } = configData;
      console.log(`\n📂 [${category}] target: ${limit}`);
      const items = await fetchCategoryItems(sources, limit);
      console.log(`  📊 Got ${items.length}/${limit} items`);
      categoryResults[category] = items;
      totalFetched += items.length;

      items.forEach(item => {
        const num = globalIndex++;
        let snippet = item.contentSnippet || item.content || '';
        snippet = snippet.replace(/<[^>]*>?/gm, '').trim();
        if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';

        cacheData[num] = {
          category,
          title: item.title || '(无标题)',
          link: item.link || '',
          snippet
        };
        textToTranslate += `[${num}] ${item.title || ''}\n`;
      });
    }

    console.log(`\n✅ Total fetched: ${totalFetched} items`);

    if (globalIndex === 1) {
      console.log('📭 No items found at all.');
      await bot.telegram.sendMessage(myUserId, '❌ 早报抓取失败，所有 RSS 源均无法访问，请稍后重试。');
      return;
    }

    // 翻译标题
    const { translateToChinese } = require('./ai');
    let translatedText = textToTranslate;
    try {
      console.log('Translating titles...');
      translatedText = await translateToChinese(textToTranslate);
    } catch(e) {
      console.log('Translation failed, using originals:', e.message);
    }

    const translatedMap = {};
    for (const line of translatedText.split('\n')) {
      const match = line.match(/^\[(\d+)\]\s*(.*)$/);
      if (match) translatedMap[match[1]] = match[2].trim();
    }

    function escapeHTML(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // 构建最终消息
    let finalMessage = `📰 <b>今日早报全矩阵看板</b> (共${totalFetched}条)\n\n回复【序号】一键生成推文草稿：\n`;

    for (const [category, items] of Object.entries(categoryResults)) {
      if (items.length === 0) continue;
      finalMessage += `\n🔹 <b>【${category}】</b> ${items.length}条\n`;
    }

    finalMessage += '\n───────────────────\n';

    let currentCategory = '';
    for (let i = 1; i < globalIndex; i++) {
      const data = cacheData[i];
      if (!data) continue;
      if (data.category !== currentCategory) {
        currentCategory = data.category;
        finalMessage += `\n🔹 <b>【${currentCategory}】</b>\n`;
      }
      const title = translatedMap[i] || data.title;
      if (data.link) {
        finalMessage += `<b>[${i}]</b> <a href="${escapeHTML(data.link)}">${escapeHTML(title)}</a>\n\n`;
      } else {
        finalMessage += `<b>[${i}]</b> ${escapeHTML(title)}\n\n`;
      }
    }

    // 保存缓存
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf-8');

    // 分块发送（每块 ≤ 4000字符）
    const maxLen = 4000;
    const linesMsg = finalMessage.split('\n');
    let chunk = '';
    for (const line of linesMsg) {
      if (chunk.length + line.length + 1 > maxLen) {
        await bot.telegram.sendMessage(myUserId, chunk, { parse_mode: 'HTML', disable_web_page_preview: true });
        chunk = '';
      }
      chunk += line + '\n';
    }
    if (chunk.trim().length > 0) {
      await bot.telegram.sendMessage(myUserId, chunk, { parse_mode: 'HTML', disable_web_page_preview: true });
    }

    console.log(`✅ Daily news sent! Total: ${totalFetched} items`);

  } catch (err) {
    console.error('Fatal error:', err);
    await bot.telegram.sendMessage(myUserId, `❌ 早报获取失败: ${err.message}`);
  }
}

main().catch(console.error);
