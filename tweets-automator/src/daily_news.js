const fs = require('fs');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const Parser = require('rss-parser');
const config = require('./config');

const parser = new Parser({ 
  timeout: 12000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});
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
    limit: 10,
    sources: [
      // ── GitHub 趋势 (多节点备用，防止某个节点失效，由于代码中新增了按链接去重，这里不会重复) ──
      { url: "https://rsshub.app/github/trending/daily/any",        ignoreSeen: true, label: "GitHub 每日趋势(官方节点)" },
      { url: "https://rsshub.rssforever.com/github/trending/daily/any", ignoreSeen: true, label: "GitHub 每日趋势(备用节点1)" },
      { url: "https://rsshub.nl/github/trending/daily/any",         ignoreSeen: true, label: "GitHub 每日趋势(备用节点2)" }
    ]
  },
  "科技人工智能 (Tech & AI)": {
    limit: 10,
    sources: [
      { url: "https://feeds.feedburner.com/ruanyifeng", quota: 3, label: "阮一峰" },
      { url: "https://www.qbitai.com/feed",             quota: 4, label: "量子位" },
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
      // ── V2EX 热门主题: 程序员/互联网人的真实生活、职场、情感、搞钱吐槽，极具话题性 ──
      { url: "https://rsshub.rssforever.com/v2ex/topics/hot",           quota: 4, label: "V2EX 热门讨论" },
      // ── 虎扑步行街: 极度接地气的两性、生活、社会毒打真实案例 ──
      { url: "https://rsshub.rssforever.com/hupu/bbs/bxj",              quota: 3, label: "虎扑步行街" },
      // ── 知乎热榜: 经典的高质量/反常识问答聚集地 ──
      { url: "https://rsshub.rssforever.com/zhihu/hot",                 quota: 3, label: "知乎热榜" }
    ]
  },
  "热门信息 (Trending Info)": {
    limit: 10,
    sources: [
      { url: "https://markmanson.net/feed",                             quota: 5, ignoreSeen: true, priority: 100, label: "Mark Manson (犀利的生活哲学)" },
      { url: "https://jamesclear.com/feed",                             quota: 3, ignoreSeen: true, priority: 90, label: "James Clear (原子习惯/微小进步)" },
      { url: "https://tim.blog/feed/",                                  quota: 2, ignoreSeen: true, priority: 80, label: "Tim Ferriss (顶级效率与个人成长)" }
    ]
  }
};

// 分类的简短 key 映射（用于 bot action）
const categoryKeyMap = {
  tools:   "实用工具资源 (Tools & Resources)",
  tech:    "科技人工智能 (Tech & AI)",
  finance: "理财投资 (Finance & Investment)",
  society: "社会民生 (Society & Life)",
  trending:"热门信息 (Trending Info)",
};

// ============================================================
// 抓取单个分类，自动补位，过滤已推送内容
// ============================================================
async function fetchCategoryItems(sources, limit, seenLinks) {
  let allItems = [];
  let skipped = 0;
  const uniqueLinks = new Set(); // 用于当次抓取去重（比如多个备用源）

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);
      let items = feed.items.map(item => {
        let d = new Date(0);
        if (item.isoDate) d = new Date(item.isoDate);
        else if (item.pubDate) d = new Date(item.pubDate);
        item._parsedDate = d;
        item._priority = source.priority || 0;
        return item;
      });

      const before = items.length;
      items = items.filter(item => {
        const link = item.link || item.guid || '';
        // 1. 本次抓取去重（防止多个备用源返回相同内容）
        if (link && uniqueLinks.has(link)) return false;
        if (link) uniqueLinks.add(link);
        
        // 2. 历史去重（除非配置了 ignoreSeen）
        if (!source.ignoreSeen && link && seenLinks[link]) {
          return false;
        }
        return true;
      });
      
      // 3. 强制截断数量 (如果配置了 quota)
      if (source.quota) {
        items = items.slice(0, source.quota);
      }
      
      skipped += before - items.length;

      console.log(`  ✅ [${items.length}] ${source.label}`);
      allItems.push(...items);
    } catch (e) {
      console.error(`  ⚠️ FAILED [${source.label}]: ${e.message}`);
    }
  }

  if (skipped > 0) console.log(`  🔁 共跳过/去重: ${skipped} 条`);
  
  // 所有源的数据汇总后，先按优先级排，同优先级按时间倒序排
  allItems.sort((a, b) => {
    const aPriority = a._priority || 0;
    const bPriority = b._priority || 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    return b._parsedDate - a._parsedDate;
  });
  
  // 返回前 limit 条，保证凑够数量
  return allItems.slice(0, limit);
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
      [Markup.button.callback('🔥 仅重抓 热门信息', 'refetch_trending')],
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
