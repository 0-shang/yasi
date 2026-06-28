const fs = require('fs');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const Parser = require('rss-parser');
const config = require('./config');

const parser = new Parser({ timeout: 12000 });
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const myUserId = parseInt(process.env.TELEGRAM_USER_ID, 10);

const cacheFile = path.join(config.paths.tweets.base, 'daily_news_cache.json');
const seenLinksFile = path.join(config.paths.tweets.base, 'seen_links.json');
const SEEN_EXPIRE_DAYS = 90;

// ============================================================
// 全局去重：加载 / 保存 / 清理
// ============================================================
function loadSeenLinks() {
  if (!fs.existsSync(seenLinksFile)) return {};
  try { return JSON.parse(fs.readFileSync(seenLinksFile, 'utf-8')); }
  catch { return {}; }
}

function saveSeenLinks(seenLinks) {
  const cutoff = Date.now() - SEEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000;
  for (const [url, ts] of Object.entries(seenLinks)) {
    if (new Date(ts).getTime() < cutoff) delete seenLinks[url];
  }
  fs.writeFileSync(seenLinksFile, JSON.stringify(seenLinks, null, 2), 'utf-8');
}

// ============================================================
// RSS 信息源配置
// 实用工具: GitHub 15条 + 其他实用工具类源 15条 = 共 30条
// 其余三类合计: 30条 (各10条)
// ============================================================
const defaultRssSources = {
  "实用工具资源 (Tools & Resources)": {
    limit: 30,
    sources: [
      // ── GitHub Trending (目标15条，双镜像保证可用性) ──
      { url: "https://rsshub.rssforever.com/github/trending/daily/any", quota: 10, label: "GitHub Trending (主)" },
      { url: "https://rsshub.app/github/trending/daily/any",            quota: 10, label: "GitHub Trending (备)" },

      // ── Show HN: 开发者分享自己做的工具/网站/项目 ──
      { url: "https://hnrss.org/show",                                  quota: 5,  label: "Show HN" },

      // ── Product Hunt: 每日新产品/工具发布 ──
      { url: "https://www.producthunt.com/feed",                        quota: 4,  label: "Product Hunt" },

      // ── Lobste.rs: 程序员社区，专注实用技术工具讨论 ──
      { url: "https://lobste.rs/rss",                                   quota: 3,  label: "Lobste.rs" },

      // ── It's FOSS: 开源软件测评/推荐 ──
      { url: "https://itsfoss.com/rss",                                 quota: 3,  label: "It's FOSS" },

      // ── FOSS Post: 开源工具新闻 (补位备用) ──
      { url: "https://fosspost.org/feed",                               quota: 3,  label: "FOSS Post" },

      // ── OpenSource.com: 开源社区精选 (补位备用) ──
      { url: "https://opensource.com/feed",                             quota: 3,  label: "OpenSource.com" },
    ]
  },
  "科技人工智能 (Tech & AI)": {
    limit: 10,
    sources: [
      { url: "https://feeds.feedburner.com/ruanyifeng", quota: 3, label: "阮一峰" },
      { url: "https://www.qbitai.com/feed",             quota: 4, label: "量子位" },
      { url: "https://sspai.com/feed",                  quota: 4, label: "少数派" },
      { url: "https://openai.com/blog/rss.xml",         quota: 2, label: "OpenAI" },
      { url: "https://news.ycombinator.com/rss",        quota: 4, label: "HackerNews" },
      { url: "https://thenewstack.io/feed/",            quota: 3, label: "The New Stack" },
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
      { url: "http://news.163.com/special/00011K6L/rss_newstop.xml",                quota: 5, label: "网易头条" },
      { url: "https://feeds.bbci.co.uk/zhongwen/simp/rss.xml",                     quota: 4, label: "BBC中文" },
      { url: "https://www.zaobao.com.sg/rss/china",                                quota: 4, label: "联合早报" },
      { url: "https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_cchinalocal.xml", quota: 3, label: "RTHK" },
      { url: "https://rsshub.rssforever.com/weibo/search/hot",                     quota: 4, label: "微博热搜" },
    ]
  }
};

// 分类的简短 key 映射（用于 bot action）
const categoryKeyMap = {
  tools:   "实用工具资源 (Tools & Resources)",
  tech:    "科技人工智能 (Tech & AI)",
  finance: "理财投资 (Finance & Investment)",
  society: "社会民生 (Society & Life)",
};

// ============================================================
// 抓取单个分类，自动补位，过滤已推送内容
// ============================================================
async function fetchCategoryItems(sources, limit, seenLinks) {
  const collected = [];
  let skipped = 0;

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
      items.sort((a, b) => b._parsedDate - a._parsedDate);

      const before = items.length;
      items = items.filter(item => {
        const link = item.link || item.guid || '';
        return link && !seenLinks[link];
      });
      skipped += before - items.length;

      const toAdd = items.slice(0, stillNeed);
      collected.push(...toAdd);
      console.log(`  ✅ [${toAdd.length}] ${source.label} (过滤重复${before - items.length}条)`);
    } catch (e) {
      console.error(`  ⚠️ FAILED [${source.label}]: ${e.message}`);
    }
  }

  if (skipped > 0) console.log(`  🔁 共跳过已推送: ${skipped} 条`);
  return collected.slice(0, limit);
}

function escapeHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// 核心发送函数：抓取指定分类（或全部），追加/替换缓存，发送给用户
// categoryKeys: null = 全部抓取替换缓存; string[] = 只抓指定分类追加缓存
// ============================================================
async function runFetch(telegramBot, userId, categoryKeys = null) {
  const { translateToChinese } = require('./ai');
  const seenLinks = loadSeenLinks();
  const isFullFetch = categoryKeys === null;

  let currentCache = {};
  if (!isFullFetch && fs.existsSync(cacheFile)) {
    try { currentCache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch {}
  }

  const maxExistingIdx = isFullFetch ? 0 : Math.max(0, ...Object.keys(currentCache).map(k => parseInt(k)));

  const targetCategories = isFullFetch
    ? Object.entries(defaultRssSources)
    : Object.entries(defaultRssSources).filter(([k]) => categoryKeys.includes(k));

  let globalIndex = isFullFetch ? 1 : maxExistingIdx + 1;
  let textToTranslate = '';
  const newCacheEntries = {};
  const newSeenLinks = {};
  const categoryResults = {};
  let totalFetched = 0;

  for (const [category, cfg] of targetCategories) {
    console.log(`\n📂 [${category}] 目标: ${cfg.limit} 条`);
    const items = await fetchCategoryItems(cfg.sources, cfg.limit, seenLinks);
    console.log(`  📊 获取: ${items.length}/${cfg.limit} 条`);
    categoryResults[category] = items;
    totalFetched += items.length;

    items.forEach(item => {
      const num = globalIndex++;
      let snippet = item.contentSnippet || item.content || '';
      snippet = snippet.replace(/<[^>]*>?/gm, '').trim();
      if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';
      const link = item.link || item.guid || '';
      newCacheEntries[num] = { category, title: item.title || '(无标题)', link, snippet };
      textToTranslate += `[${num}] ${item.title || ''}\n`;
      if (link) newSeenLinks[link] = new Date().toISOString();
    });
  }

  if (totalFetched === 0) {
    await telegramBot.telegram.sendMessage(userId, '📭 没有找到新内容（可能所有内容已推送过，或 RSS 源暂时无法访问）。');
    return;
  }

  // 翻译
  let translatedText = textToTranslate;
  try {
    translatedText = await translateToChinese(textToTranslate);
  } catch (e) {
    console.log('Translation failed:', e.message);
  }

  const translatedMap = {};
  for (const line of translatedText.split('\n')) {
    const m = line.match(/^\[(\d+)\]\s*(.*)$/);
    if (m) translatedMap[m[1]] = m[2].trim();
  }

  // 构建消息
  const title = isFullFetch ? `📰 <b>今日早报全矩阵看板</b> (共${totalFetched}条，已去重)` : `🔄 <b>重新抓取结果</b> (新增${totalFetched}条)`;
  let finalMessage = `${title}\n\n回复【序号】一键生成推文草稿：\n`;

  for (const [cat, items] of Object.entries(categoryResults)) {
    if (items.length === 0) continue;
    finalMessage += `\n🔹 <b>【${cat}】</b> ${items.length}条\n`;
  }
  finalMessage += '\n───────────────────\n';

  let currentCat = '';
  const startIdx = isFullFetch ? 1 : maxExistingIdx + 1;
  for (let i = startIdx; i < globalIndex; i++) {
    const data = newCacheEntries[i];
    if (!data) continue;
    if (data.category !== currentCat) {
      currentCat = data.category;
      finalMessage += `\n🔹 <b>【${currentCat}】</b>\n`;
    }
    const title2 = translatedMap[i] || data.title;
    if (data.link) {
      finalMessage += `<b>[${i}]</b> <a href="${escapeHTML(data.link)}">${escapeHTML(title2)}</a>\n\n`;
    } else {
      finalMessage += `<b>[${i}]</b> ${escapeHTML(title2)}\n\n`;
    }
  }

  // 保存缓存
  const finalCache = isFullFetch ? newCacheEntries : Object.assign(currentCache, newCacheEntries);
  fs.writeFileSync(cacheFile, JSON.stringify(finalCache, null, 2), 'utf-8');
  saveSeenLinks(Object.assign(seenLinks, newSeenLinks));

  // 分块发送
  const maxLen = 4000;
  const lines = finalMessage.split('\n');
  let chunk = '';
  for (const line of lines) {
    if (chunk.length + line.length + 1 > maxLen) {
      await telegramBot.telegram.sendMessage(userId, chunk, { parse_mode: 'HTML', disable_web_page_preview: true });
      chunk = '';
    }
    chunk += line + '\n';
  }
  if (chunk.trim()) {
    await telegramBot.telegram.sendMessage(userId, chunk, { parse_mode: 'HTML', disable_web_page_preview: true });
  }

  // 发送重新抓取菜单
  await telegramBot.telegram.sendMessage(userId,
    '💬 对以上内容不满意？选择重新抓取：',
    Markup.inlineKeyboard([
      [Markup.button.callback('🔄 重新抓取全部',     'refetch_all')],
      [Markup.button.callback('🛠️ 仅重抓 实用工具', 'refetch_tools')],
      [Markup.button.callback('🤖 仅重抓 科技AI',   'refetch_tech')],
      [Markup.button.callback('💰 仅重抓 理财投资', 'refetch_finance')],
      [Markup.button.callback('🌍 仅重抓 社会民生', 'refetch_society')],
    ])
  );

  console.log(`✅ Done! Total: ${totalFetched} items`);
}

// ============================================================
// 导出（供 bot.js 使用）
// ============================================================
module.exports = { defaultRssSources, categoryKeyMap, fetchCategoryItems, loadSeenLinks, saveSeenLinks, runFetch, cacheFile, seenLinksFile };

// ============================================================
// 作为独立脚本运行（npm run daily）
// ============================================================
if (require.main === module) {
  if (!botToken || !myUserId) {
    console.error("Please set TELEGRAM_BOT_TOKEN and TELEGRAM_USER_ID");
    process.exit(1);
  }
  const bot = new Telegraf(botToken);
  console.log('🔄 Starting daily news fetch...');
  runFetch(bot, myUserId, null).catch(async (err) => {
    console.error('Fatal error:', err);
    await bot.telegram.sendMessage(myUserId, `❌ 早报获取失败: ${err.message}`);
  });
}
