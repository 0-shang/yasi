const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
const Parser = require('rss-parser');
const config = require('./config');

const parser = new Parser({ timeout: 12000 });
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const myUserId = parseInt(process.env.TELEGRAM_USER_ID, 10);

if (!botToken || !myUserId) {
  console.error("Please set TELEGRAM_BOT_TOKEN and TELEGRAM_USER_ID");
  process.exit(1);
}

const bot = new Telegraf(botToken);
const cacheFile = path.join(config.paths.tweets.base, 'daily_news_cache.json');

// 已推送内容记录文件（用于全局去重）
const seenLinksFile = path.join(config.paths.tweets.base, 'seen_links.json');

// ============================================================
// 全局去重：加载 / 保存 / 过滤 已推送链接
// seen_links.json 结构: { "https://...": "2026-06-28T00:00:00Z", ... }
// 超过 SEEN_EXPIRE_DAYS 天的记录自动清除，防止文件无限增长
// ============================================================
const SEEN_EXPIRE_DAYS = 90;

function loadSeenLinks() {
  if (!fs.existsSync(seenLinksFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(seenLinksFile, 'utf-8'));
  } catch {
    return {};
  }
}

function saveSeenLinks(seenLinks) {
  // 清理超过 SEEN_EXPIRE_DAYS 天的旧记录
  const cutoff = Date.now() - SEEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000;
  for (const [url, ts] of Object.entries(seenLinks)) {
    if (new Date(ts).getTime() < cutoff) delete seenLinks[url];
  }
  fs.writeFileSync(seenLinksFile, JSON.stringify(seenLinks, null, 2), 'utf-8');
}

// ============================================================
// RSS 信息源配置
// - 实用工具资源: ≥30 条（GitHub Trending + Show HN + ProductHunt + Lobsters + ItsFOSS + BetaList）
// - 其余三类合计: ≥30 条（每类各取10条）
// ============================================================
const defaultRssSources = {
  "实用工具资源 (Tools & Resources)": {
    limit: 30,
    sources: [
      // GitHub Trending - 最直接的开源项目发现源
      { url: "https://rsshub.rssforever.com/github/trending/daily/any", quota: 10, label: "GitHub Trending (主)" },
      { url: "https://rsshub.app/github/trending/daily/any",            quota: 10, label: "GitHub Trending (备)" },

      // Hacker News - Show HN 频道：开发者分享自己做的工具/网站/项目
      { url: "https://hnrss.org/show",                                  quota: 8,  label: "Show HN" },

      // Product Hunt：每日新产品/工具发布
      { url: "https://www.producthunt.com/feed",                        quota: 8,  label: "Product Hunt" },

      // Lobste.rs：程序员社区，类似HN但更专注工具和技术
      { url: "https://lobste.rs/rss",                                   quota: 6,  label: "Lobste.rs" },

      // It's FOSS：专注开源软件测评/推荐
      { url: "https://itsfoss.com/rss",                                 quota: 6,  label: "It's FOSS" },

      // FOSS Post：开源软件新闻与推荐
      { url: "https://fosspost.org/feed",                               quota: 5,  label: "FOSS Post" },

      // BetaList：还在测试阶段的新工具/产品
      { url: "https://betalist.com/feed",                               quota: 5,  label: "BetaList" },

      // Hacker News Best：高质量技术讨论，经常包含工具推荐
      { url: "https://hnrss.org/best",                                  quota: 5,  label: "HN Best" },
    ]
  },
  "科技人工智能 (Tech & AI)": {
    limit: 10,
    sources: [
      { url: "https://feeds.feedburner.com/ruanyifeng",  quota: 3, label: "阮一峰" },
      { url: "https://www.qbitai.com/feed",              quota: 4, label: "量子位" },
      { url: "https://sspai.com/feed",                   quota: 4, label: "少数派" },
      { url: "https://openai.com/blog/rss.xml",          quota: 2, label: "OpenAI" },
      { url: "https://news.ycombinator.com/rss",         quota: 4, label: "HackerNews" },
      { url: "https://thenewstack.io/feed/",             quota: 3, label: "The New Stack" },
    ]
  },
  "理财投资 (Finance & Investment)": {
    limit: 10,
    sources: [
      { url: "https://xueqiu.com/hots/topic/rss",            quota: 5, label: "雪球热帖" },
      { url: "https://www.fool.com/feeds/index.aspx",         quota: 4, label: "Motley Fool" },
      { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", quota: 4, label: "WSJ Market" },
      { url: "https://www.moneyweek.com/rss",                 quota: 3, label: "MoneyWeek" },
    ]
  },
  "社会民生 (Society & Life)": {
    limit: 10,
    sources: [
      { url: "http://news.163.com/special/00011K6L/rss_newstop.xml",               quota: 5, label: "网易头条" },
      { url: "https://feeds.bbci.co.uk/zhongwen/simp/rss.xml",                    quota: 4, label: "BBC中文" },
      { url: "https://www.zaobao.com.sg/rss/china",                               quota: 4, label: "联合早报" },
      { url: "https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_cchinalocal.xml", quota: 3, label: "RTHK" },
      { url: "https://rsshub.rssforever.com/weibo/search/hot",                    quota: 4, label: "微博热搜" },
    ]
  }
};

// ============================================================
// 抓取单个分类，自动补位，并过滤已推送内容
// ============================================================
async function fetchCategoryItems(sources, limit, seenLinks) {
  const collected = [];
  const skippedCount = { total: 0 };

  for (const source of sources) {
    if (collected.length >= limit) break;
    const stillNeed = limit - collected.length;

    try {
      const feed = await parser.parseURL(source.url);
      let items = feed.items.map(item => {
        let d = new Date(0);
        if (item.isoDate) d = new Date(item.isoDate);
        else if (item.pubDate) d = new Date(item.pubDate);
        item._parsedDate = d;
        return item;
      });

      // 按发布时间降序
      items.sort((a, b) => b._parsedDate - a._parsedDate);

      // 过滤已推送的链接
      const beforeFilter = items.length;
      items = items.filter(item => {
        const link = item.link || item.guid || '';
        return link && !seenLinks[link];
      });
      const filtered = beforeFilter - items.length;
      if (filtered > 0) skippedCount.total += filtered;

      // 只取需要的数量
      const toAdd = items.slice(0, stillNeed);
      collected.push(...toAdd);

      console.log(`  ✅ [${toAdd.length}取/${source.quota}配额] ${source.label || source.url.slice(0, 50)} (已过滤重复${filtered}条)`);
    } catch (e) {
      console.error(`  ⚠️ FAILED [${source.label || '?'}]: ${e.message}`);
    }
  }

  if (skippedCount.total > 0) {
    console.log(`  🔁 该分类共跳过已推送内容: ${skippedCount.total} 条`);
  }

  return collected.slice(0, limit);
}

async function main() {
  console.log('🔄 Starting daily news fetch with deduplication...');

  try {
    // 加载已推送链接记录
    const seenLinks = loadSeenLinks();
    const totalSeenBefore = Object.keys(seenLinks).length;
    console.log(`📌 已记录推送链接数: ${totalSeenBefore}`);

    let globalIndex = 1;
    let textToTranslate = "";
    const cacheData = {};
    let totalFetched = 0;
    const newSeenLinks = {}; // 本次新推送的链接，用于追加到 seenLinks

    const categoryResults = {};

    for (const [category, configData] of Object.entries(defaultRssSources)) {
      const { sources, limit } = configData;
      console.log(`\n📂 [${category}] 目标: ${limit} 条`);
      const items = await fetchCategoryItems(sources, limit, seenLinks);
      console.log(`  📊 实际获取: ${items.length}/${limit} 条`);
      categoryResults[category] = items;
      totalFetched += items.length;

      items.forEach(item => {
        const num = globalIndex++;
        let snippet = item.contentSnippet || item.content || '';
        snippet = snippet.replace(/<[^>]*>?/gm, '').trim();
        if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';

        const link = item.link || item.guid || '';

        cacheData[num] = {
          category,
          title: item.title || '(无标题)',
          link,
          snippet
        };
        textToTranslate += `[${num}] ${item.title || ''}\n`;

        // 记录为已推送
        if (link) newSeenLinks[link] = new Date().toISOString();
      });
    }

    console.log(`\n✅ Total fetched: ${totalFetched} items`);

    if (globalIndex === 1) {
      console.log('📭 No new items found at all.');
      await bot.telegram.sendMessage(myUserId, '❌ 没有找到新内容（所有内容可能已经推送过，或 RSS 源暂时无法访问）。');
      return;
    }

    // 翻译标题
    const { translateToChinese } = require('./ai');
    let translatedText = textToTranslate;
    try {
      console.log('Translating titles...');
      translatedText = await translateToChinese(textToTranslate);
    } catch (e) {
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

    // 构建消息
    let finalMessage = `📰 <b>今日早报全矩阵看板</b> (共${totalFetched}条，已去重)\n\n回复【序号】一键生成推文草稿：\n`;

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

    // 保存缓存 & 更新已推送记录
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf-8');
    const updatedSeenLinks = Object.assign({}, seenLinks, newSeenLinks);
    saveSeenLinks(updatedSeenLinks);
    console.log(`📌 新增推送记录: ${Object.keys(newSeenLinks).length} 条，总计: ${Object.keys(updatedSeenLinks).length} 条`);

    // 分块发送（每块 ≤ 4000 字符）
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
