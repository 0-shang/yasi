require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const config = require('./config');
const { postTweetOrThread } = require('./twitter');
const { generateTweetsFromContent, generateHotTweetsFromRSS, chatWithAI, simpleChatWithAI, generateWeChatArticle } = require('./ai');
const Parser = require('rss-parser');
const parser = new Parser();
const cron = require('node-cron');
const cheerio = require('cheerio');
const { runFetch, categoryKeyMap } = require('./daily_news');
const wechat = require('./wechat');
const { marked } = require('marked');

// Setup environment and paths
config.ensureDirs();
const publishedDir = config.paths.tweets.published;
const approvedDir = config.paths.tweets.approved;
const draftsDir = config.paths.tweets.drafts;

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const myUserId = parseInt(process.env.TELEGRAM_USER_ID, 10);

if (!botToken || !myUserId) {
  console.error("Please set TELEGRAM_BOT_TOKEN and TELEGRAM_USER_ID in your .env file.");
  process.exit(1);
}

const bot = new Telegraf(botToken);

// Global error handler to prevent crash loops from unhandled rejections (e.g. old queries)
bot.catch((err, ctx) => {
  console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
});

// In-memory store for pending tweets
const pendingTweets = new Map();
// In-memory store for pending files from GitHub
const checkPendingFiles = new Map();
// In-memory store for edit state
const editingState = new Map();
// In-memory store for conversational chat
const chatMemory = new Map();
// In-memory store for chat mode toggle
const isChatMode = new Map();
// In-memory store for WeChat mode toggle
const isWeChatMode = new Map();
const pendingWechatDrafts = new Map();

// In-memory store for clippings and context
const clippingsCache = new Map();
const activeListContext = new Map();

// Scheduling state
let lastScheduledTime = 0;
let scheduleIntervalIndex = 0;
const SCHEDULE_INTERVALS = [37, 47, 57];

// Helper: Fetch URL content
async function enrichTextWithUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex);
  if (!urls) return text;

  let enrichedText = text + '\n\n--- [系统自动抓取的链接内容] ---\n';
  for (const url of urls) {
    try {
      // Basic fetch
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0)' }
      });
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Remove noise
      $('script, style, noscript, iframe, img, svg, video, nav, footer, header').remove();
      
      let pageText = $('body').text().replace(/\s+/g, ' ').trim();
      if (pageText.length > 3000) {
        pageText = pageText.substring(0, 3000) + '... (内容过长已截断)';
      }
      enrichedText += `\n【${url}】:\n${pageText}\n`;
    } catch (e) {
      enrichedText += `\n【${url}】无法读取内容: ${e.message}\n`;
    }
  }
  return enrichedText;
}

// Helper: Save to markdown file and sync to github
function saveAndSyncToGithub(content, type = 'published', tweetResult = null, scheduleTime = null, ctx = null) {
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = Date.now().toString().slice(-6); // Just for uniqueness
  const filename = `${dateStr}_tg_bot_${timeStr}.md`;
  
  const targetDir = type === 'published' ? publishedDir
                   : type === 'approved'  ? approvedDir
                   : draftsDir;
  const filePath = path.join(targetDir, filename);

  const cleanBody = content.replace(/[\r\n]+/g, ' ').trim();
  let description = cleanBody.slice(0, 100);
  if (cleanBody.length > 100) description += '...';

  const frontmatter = {
    title: `Bot Draft ${dateStr}`,
    date: dateStr,
    description: description,
    tags: ['feed'],
    status: type
  };

  if (scheduleTime) {
    frontmatter.schedule_time = scheduleTime;
    frontmatter.status = 'approved';
  }

  if (tweetResult) {
    frontmatter.published_at = new Date().toISOString();
    frontmatter.tweet_id = tweetResult.id;
    frontmatter.urls = tweetResult.urls;
  }

  const fileContent = matter.stringify(content, frontmatter);
  fs.writeFileSync(filePath, fileContent, 'utf-8');

  // Trigger Git Sync in background
  const repoRoot = path.join(__dirname, '..', '..');
  const pat = process.env.GITHUB_PAT || '';
  let pushCmd = `git push`;
  if (pat) {
    pushCmd = `git push https://${pat}@github.com/0-shang/yasi.git HEAD:main`;
  }
  exec(`git add tweets/ && git commit -m "bot: auto saved ${type} tweet" && git pull --rebase origin main && ${pushCmd}`, { cwd: repoRoot }, (err, stdout, stderr) => {
    if (err) {
      const safeMsg = pat ? err.message.replace(new RegExp(pat, 'g'), '***') : err.message;
      console.error('Git sync failed:', safeMsg);
      if (ctx) ctx.reply(`❌ Git sync failed: ${safeMsg}`);
    } else {
      console.log('Git sync success.');
      if (type === 'published') {
        syncCrossRepo(ctx);
      }
    }
  });

  return filename;
}

// Function to sync published tweets to ai-nav repo
function syncCrossRepo(ctx = null) {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    console.log('No GITHUB_PAT found, skipping cross-repo sync.');
    return;
  }
  
  const repoRoot = path.join(__dirname, '..', '..');
  const tempDir = path.join(repoRoot, 'temp-web');
  const destDir = path.join(tempDir, 'content', 'tweets');
  
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  
  if (ctx) ctx.reply('🔄 Syncing to ai-nav repository...');
  
  exec(`git clone https://${pat}@github.com/0-shang/ai-nav.git temp-web`, { cwd: repoRoot }, (err) => {
    if (err) {
      if (ctx) ctx.reply('❌ Failed to clone ai-nav repo for syncing.');
      return;
    }
    
    fs.mkdirSync(destDir, { recursive: true });
    
    // Copy files
    const pubDir = config.paths.tweets.published;
    if (fs.existsSync(pubDir)) {
      const files = fs.readdirSync(pubDir).filter(f => f.endsWith('.md'));
      files.forEach(f => {
        fs.copyFileSync(path.join(pubDir, f), path.join(destDir, f));
      });
    }
    
    // Pull rebase first to avoid non-fast-forward, then push
    const cmd = `git config user.name "bot" && git config user.email "bot@example.com" && git add content/tweets/ && (git diff-index --quiet HEAD || git commit -m "bot: auto-sync published tweets") && git pull --rebase https://${pat}@github.com/0-shang/ai-nav.git master && git push https://${pat}@github.com/0-shang/ai-nav.git HEAD:master`;
    exec(cmd, { cwd: tempDir }, (err, stdout, stderr) => {
      if (err) {
        const safeMsg = pat ? err.message.replace(new RegExp(pat, 'g'), '***') : err.message;
        console.error('Cross-repo sync push failed:', safeMsg);
        if (ctx) ctx.reply(`⚠️ ai-nav 同步过程中出现问题: ${safeMsg}`);
      } else {
        if (ctx) ctx.reply('✅ Successfully synced cross-repository to ai-nav!');
      }
      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });
}

// Setup Cron Job for hourly publishing between 7:00 and 23:00 Beijing time
cron.schedule('0 7-23 * * *', () => {
  console.log('Running scheduled hourly publish task (7-23 Beijing time)...');
  const automatorDir = path.join(__dirname, '..');
  const repoRoot = path.join(__dirname, '..', '..');
  const env = Object.assign({}, process.env, { 
    IGNORE_TIME_RESTRICTION: 'true',
    MAX_TWEETS_PER_RUN: '1' // Only publish one per hour
  });

  // 先 git pull，同步 GitHub 上的删除操作，再执行发布
  exec('git pull --rebase origin main', { cwd: repoRoot }, (pullErr) => {
    if (pullErr) {
      console.error('Pre-publish git pull failed:', pullErr.message);
      // 必须在这里阻断！如果 pull 失败（如 rebase 卡死、冲突等），VPS 本地可能残留已经被 GitHub 删掉的旧推文。
      // 如果继续发推，会导致机器人发出旧内容或者重复发推。
      return;
    }
    exec('npm run publish', { cwd: automatorDir, env }, (err, stdout, stderr) => {
      if (err) {
        console.error('Hourly publish failed:', err.message);
        return;
      }
      const pat = process.env.GITHUB_PAT || '';
      let pushCmd = 'git push';
      if (pat) pushCmd = `git push https://${pat}@github.com/0-shang/yasi.git HEAD:main`;

      exec(`git add tweets/ && git commit --allow-empty -m "bot: auto hourly publish" && ${pushCmd}`, { cwd: repoRoot }, (errSync) => {
        if (errSync) console.error('Git sync failed after hourly publish:', errSync);
        syncCrossRepo(null);
      });
    });
  });
}, {
  timezone: "Asia/Shanghai"
});

bot.start((ctx) => {
  if (ctx.from.id !== myUserId) {
    return ctx.reply("Sorry, you are not authorized to use this bot.");
  }
  ctx.reply(
    "👋 欢迎！您可以直接发送任何长篇文字/链接，我将为您提炼为专业推文。\n\n💡 快捷指令:\n- `/daily` 抓取最新早报\n- `/news` 一键唤出上次早报\n- `/check` 检查并发布队列推文\n- `/chat` 切换纯聊天模式",
    Markup.inlineKeyboard([
      [Markup.button.callback('📰 抓取最新早报', 'fetch_daily')],
      [Markup.button.callback('📋 查看上次早报', 'show_cached_news')],
      [Markup.button.callback('💬 切换为 闲聊模式', 'mode_chat'), Markup.button.callback('🐦 切换为 推文模式', 'mode_tweet')],
      [Markup.button.callback('📝 切换为 公众号模式', 'mode_mp')]
    ])
  );
});

bot.action('mode_chat', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  isChatMode.set(myUserId, true);
  isWeChatMode.set(myUserId, false);
  await ctx.answerCbQuery('已切换到闲聊模式');
  await ctx.reply("🤖 已切换到【闲聊模式】。在这个模式下，我会像一个普通的智能体助手一样与你对话，不会自动帮你生成推文。");
});

bot.action('mode_tweet', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  isChatMode.set(myUserId, false);
  isWeChatMode.set(myUserId, false);
  await ctx.answerCbQuery('已切换到推文模式');
  await ctx.reply("🐦 已切换回【推文生成模式】。你发送给我的任何想法都会被提炼为推文草稿。");
});

bot.action('mode_mp', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  isWeChatMode.set(myUserId, true);
  isChatMode.set(myUserId, false);
  await ctx.answerCbQuery('已切换到公众号模式');
  await ctx.reply("📝 已切换到【微信公众号模式】。你发送给我的任何主题，我都会自动为您撰写一篇图文并茂的公众号长文。");
});

bot.command('chat', (ctx) => {
  if (ctx.from.id !== myUserId) return;
  isChatMode.set(myUserId, true);
  isWeChatMode.set(myUserId, false);
  ctx.reply("🤖 已切换到【闲聊模式】。在这个模式下，我会像一个普通的智能体助手一样与你对话，不会自动帮你生成推文。");
});

bot.command('tweet', (ctx) => {
  if (ctx.from.id !== myUserId) return;
  isChatMode.set(myUserId, false);
  isWeChatMode.set(myUserId, false);
  ctx.reply("🐦 已切换回【推文生成模式】。你发送给我的任何想法都会被提炼为推文草稿。");
});

bot.command('mp', (ctx) => {
  if (ctx.from.id !== myUserId) return;
  isWeChatMode.set(myUserId, true);
  isChatMode.set(myUserId, false);
  ctx.reply("📝 已切换到【微信公众号模式】。你发送给我的任何主题，我都会自动为您撰写一篇图文并茂的公众号长文。");
});

// Helper: re-send cached news board
async function sendCachedNews(ctx) {
  const cacheFile = path.join(config.paths.tweets.base, 'daily_news_cache.json');
  if (!fs.existsSync(cacheFile)) {
    return ctx.reply('📭 还没有缓存的早报，请先点击「抓取最新早报」或发送 /daily');
  }
  
  const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const keys = Object.keys(cache).sort((a, b) => parseInt(a) - parseInt(b));
  
  if (keys.length === 0) {
    return ctx.reply('📭 缓存为空，请先抓取早报。');
  }
  
  function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  
  activeListContext.set(ctx.from.id, 'news');
  let msg = "📰 <b>早报看板（缓存）</b>\n\n回复【数字序号】生成推文草稿：\n\n";
  let currentCategory = "";
  
  for (const key of keys) {
    const item = cache[key];
    if (item.category && item.category !== currentCategory) {
      currentCategory = item.category;
      msg += `\n🔹 <b>【${currentCategory}】</b>\n`;
    }
    const title = escapeHTML(item.title || '');
    if (item.link) {
      msg += `<b>[${key}]</b> <a href="${escapeHTML(item.link)}">${title}</a>\n\n`;
    } else {
      msg += `<b>[${key}]</b> ${title}\n\n`;
    }
  }
  
  await ctx.reply(msg, { parse_mode: 'HTML', disable_web_page_preview: true });
}

bot.command('news', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  await sendCachedNews(ctx);
});

bot.action('show_cached_news', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  await ctx.answerCbQuery();
  await sendCachedNews(ctx);
});

bot.command('daily', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  await ctx.reply('🔄 正在呼叫后台引擎抓取、筛选并翻译多源早报...（可能需要1-2分钟，请稍候）');
  exec('npm run daily', { cwd: path.join(__dirname, '..') }, (err) => {
    if (err) console.error('Daily fetch error:', err);
  });
});

bot.action('fetch_daily', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  await ctx.answerCbQuery();
  await ctx.reply('🔄 正在呼叫后台引擎抓取、筛选并翻译多源早报...（可能需要1-2分钟，请稍候）');
  exec('npm run daily', { cwd: path.join(__dirname, '..') }, (err) => {
    if (err) console.error('Daily fetch error:', err);
  });
});

// ─── 重新抓取：弹出选择菜单 ───
bot.command('refetch', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  await ctx.reply(
    '🔄 请选择重新抓取的范围：',
    Markup.inlineKeyboard([
      [Markup.button.callback('🔄 重新抓取全部',     'refetch_all')],
      [Markup.button.callback('🐦 仅重抓 推文',     'refetch_tweets')],
      [Markup.button.callback('🛠️ 仅重抓 实用工具', 'refetch_tools')],
      [Markup.button.callback('🤖 仅重抓 科技AI',   'refetch_tech')],
      [Markup.button.callback('💰 仅重抓 理财投资', 'refetch_finance')],
      [Markup.button.callback('🌍 仅重抓 社会民生', 'refetch_society')],
      [Markup.button.callback('🌱 仅重抓 个人成长', 'refetch_trending')],
      [Markup.button.callback('🏅 仅重抓 体育产业', 'refetch_sports')],
    ])
  );
});

// 重新抓取全部
bot.action('refetch_all', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  await ctx.answerCbQuery();
  await ctx.reply('🔄 正在重新抓取全部早报，请稍候（1-2分钟）...');
  try {
    await runFetch(bot, myUserId, null);
  } catch (e) {
    console.error('refetch_all error:', e);
    await ctx.reply(`❌ 重新抓取失败: ${e.message}`);
  }
});

// 重新抓取单个分类
async function handleRefetchCategory(ctx, shortKey) {
  if (ctx.from.id !== myUserId) return;
  await ctx.answerCbQuery();
  const categoryName = categoryKeyMap[shortKey];
  if (!categoryName) return ctx.reply('❌ 未知分类');
  await ctx.reply(`🔄 正在重新抓取【${categoryName}】，请稍候...`);
  try {
    await runFetch(bot, myUserId, [categoryName]);
  } catch (e) {
    console.error(`refetch_${shortKey} error:`, e);
    await ctx.reply(`❌ 重新抓取失败: ${e.message}`);
  }
}

bot.action('refetch_tools',   (ctx) => handleRefetchCategory(ctx, 'tools'));
bot.action('refetch_tech',    (ctx) => handleRefetchCategory(ctx, 'tech'));
bot.action('refetch_finance', (ctx) => handleRefetchCategory(ctx, 'finance'));
bot.action('refetch_society', (ctx) => handleRefetchCategory(ctx, 'society'));
bot.action('refetch_trending', (ctx) => handleRefetchCategory(ctx, 'trending'));
bot.action('refetch_tweets',  (ctx) => handleRefetchCategory(ctx, 'tweets'));
bot.action('refetch_sports',  (ctx) => handleRefetchCategory(ctx, 'sports'));

bot.command('rss', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const loadingMsg = await ctx.reply('🔄 Fetching daily RSS feed and generating 10 hot tweets... Please wait, this might take a minute.');
  
  if (!config.RSS_FEED_URL) {
    return ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, '❌ RSS_FEED_URL is not configured in .env file.');
  }

  try {
    const feed = await parser.parseURL(config.RSS_FEED_URL);
    
    // Filter for last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let recentItems = feed.items.filter(item => {
      if (!item.isoDate && !item.pubDate) return true; // keep if no date
      const d = new Date(item.isoDate || item.pubDate);
      return d > oneDayAgo;
    });
    
    // If we have none in the last 24 hours, fallback to the latest 15
    if (recentItems.length === 0) {
      recentItems = feed.items.slice(0, 15);
    }
    
    recentItems = recentItems.slice(0, 30); // limit to 30 to avoid huge prompt
    
    if (recentItems.length === 0) {
      return ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, '📭 No items found in the RSS feed.');
    }
    
    // Truncate snippet to max 400 characters to save tokens and focus on main points
    const feedText = recentItems.map(item => {
      let snippet = item.contentSnippet || item.content || '';
      if (snippet.length > 400) snippet = snippet.substring(0, 400) + '...';
      // Clean up HTML tags if there are any left
      snippet = snippet.replace(/<[^>]*>?/gm, ''); 
      return `Title: ${item.title}\nLink: ${item.link}\nSnippet: ${snippet}`;
    }).join('\n\n');
    
    const aiResults = await generateHotTweetsFromRSS(feedText);
    
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `✅ Generated exactly 10 hot tweets from today's RSS (${feed.title || config.RSS_FEED_URL}):`);
    
    for (let i = 0; i < aiResults.length; i++) {
      const option = aiResults[i];
      const newMsgId = Date.now() + i;
      pendingTweets.set(newMsgId, option.content);
      
      await ctx.reply(
        `💡 **Angle**: ${option.angle}\n\n${option.content}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🚀 发布这个版本', `post_${newMsgId}`)],
          [Markup.button.callback('🧵 转为 Thread', `thread_${newMsgId}`)],
          [Markup.button.callback('✏️ 修改', `edittweet_${newMsgId}`)],
          [Markup.button.callback('📅 定时发送', `schedule_${newMsgId}`)]
        ])
      );
    }
    
  } catch (err) {
    console.error(err);
    return ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ Failed to process RSS:\n${err.message}`);
  }
});

bot.command('check', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const loadingMsg = await ctx.reply('🔄 Pulling latest files from GitHub...');
  
  const repoRoot = path.join(__dirname, '..', '..');
  exec('git pull origin main', { cwd: repoRoot }, (err, stdout, stderr) => {
    if (err) {
      return ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ Failed to pull from GitHub:\n${err.message}`);
    }
    
    // Scan drafts directory
    let files = [];
    if (fs.existsSync(config.paths.tweets.drafts)) {
      files = fs.readdirSync(config.paths.tweets.drafts).filter(f => f.endsWith('.md'));
    }
    
    if (files.length === 0) {
      return ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, '📭 No pending tweets found in the "drafts" folder.');
    }
    
    ctx.telegram.editMessageText(
      ctx.chat.id, 
      loadingMsg.message_id, 
      undefined,
      `📦 Found ${files.length} pending tweet(s) in "drafts" folder.\nSelect a file to preview/publish:`,
      Markup.inlineKeyboard(
        files.map((f, index) => {
          const fileId = Date.now() + index;
          checkPendingFiles.set(fileId, f);
          return [Markup.button.callback(`📄 查看: ${f.slice(0, 30)}...`, `viewfile_${fileId}`)];
        }).concat([
          [Markup.button.callback('🚀 一键发布全部 (Publish All)', 'publish_approved')],
          [Markup.button.callback('❌ 取消 (Cancel)', 'cancel_publish')]
        ])
      )
    );
  });
});

bot.action(/viewfile_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const fileId = parseInt(ctx.match[1], 10);
  const filename = checkPendingFiles.get(fileId);
  
  if (!filename) {
    return ctx.answerCbQuery('File session expired, please /check again.');
  }

  const filePath = path.join(config.paths.tweets.drafts, filename);
  if (!fs.existsSync(filePath)) {
    return ctx.answerCbQuery('File no longer exists.');
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(content);

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `📄 **Preview of ${filename}**\n\n${parsed.content.trim()}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🚀 确认发布', `pubfile_${fileId}`)],
      [Markup.button.callback('✏️ 修改内容', `editfile_${fileId}`)],
      [Markup.button.callback('🗑️ 删除', `delfile_${fileId}`)],
      [Markup.button.callback('❌ 返回', `cancel_publish`)]
    ])
  );
});

bot.action(/delfile_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const fileId = parseInt(ctx.match[1], 10);
  const filename = checkPendingFiles.get(fileId);
  
  if (!filename) {
    return ctx.answerCbQuery('File session expired.');
  }

  const filePath = path.join(config.paths.tweets.drafts, filename);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
    
    // Sync to GitHub
    const repoRoot = path.join(__dirname, '..', '..');
    const pat = process.env.GITHUB_PAT || '';
    const pushCmd = pat ? `git push https://${pat}@github.com/0-shang/yasi.git HEAD:main` : 'git push';
    exec(`git rm tweets/drafts/${filename} && git commit -m "bot: deleted ${filename}" && git pull --rebase origin main && ${pushCmd}`, { cwd: repoRoot }, (err) => {
      if (err) console.error('Git delete sync failed:', err.message);
    });
  }

  checkPendingFiles.delete(fileId);
  await ctx.answerCbQuery('Deleted successfully.');
  await ctx.editMessageText(`🗑️ 已成功删除推文草稿：${filename}`);
});

bot.action(/editfile_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const fileId = parseInt(ctx.match[1], 10);
  const filename = checkPendingFiles.get(fileId);
  
  if (!filename) return ctx.answerCbQuery('File session expired.');

  const filePath = path.join(config.paths.tweets.drafts, filename);
  if (!fs.existsSync(filePath)) return ctx.answerCbQuery('File no longer exists.');

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(content);

  editingState.set(myUserId, { type: 'file', fileId: fileId, filename });
  
  await ctx.answerCbQuery();
  await ctx.reply(
    `✏️ **Editing ${filename}**\n\nPlease copy the text below, make your changes, and send it back to me as a new message:\n\n\`\`\`text\n${parsed.content.trim()}\n\`\`\``, 
    { parse_mode: 'Markdown' }
  );
});

bot.action(/pubfile_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const fileId = parseInt(ctx.match[1], 10);
  const filename = checkPendingFiles.get(fileId);
  
  if (!filename) {
    return ctx.answerCbQuery('File session expired, please /check again.');
  }

  await ctx.answerCbQuery();
  await ctx.editMessageText(`⏳ Publishing "${filename}"... Please wait.`);
  
  const automatorDir = path.join(__dirname, '..');
  const env = Object.assign({}, process.env, { 
    TARGET_FILE: filename,
    IGNORE_TIME_RESTRICTION: 'true'
  });
  
  exec('npm run publish', { cwd: automatorDir, env }, (err, stdout, stderr) => {
    if (err) {
      return ctx.editMessageText(`❌ Failed to publish ${filename}:\n${err.message}\n\n${stderr}`);
    }
    
    // Automatically commit and push the changes (moved files from drafts to published)
    const repoRoot = path.join(__dirname, '..', '..');
    const patForPub = process.env.GITHUB_PAT || '';
    const pushCmdForPub = patForPub ? `git push https://${patForPub}@github.com/0-shang/yasi.git HEAD:main` : 'git push';
    exec(`git add tweets/ && git commit --allow-empty -m "bot: published ${filename}" && ${pushCmdForPub}`, { cwd: repoRoot }, () => {
      const lines = stdout.split('\n');
      const urlLines = lines.filter(l => l.includes('Moved file to'));
      
      if (urlLines.length > 0) {
        ctx.editMessageText(`✅ Successfully published 1 tweet(s) and synced to GitHub!\n\nOpen your Twitter to see them!`);
        syncCrossRepo(ctx);
      } else {
        ctx.editMessageText(`❌ Failed to publish. It might have been blocked or failed. Please check logs.`);
      }
    });
  });
});

bot.action('publish_approved', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  await ctx.answerCbQuery();
  await ctx.editMessageText('⏳ Publishing all approved/scheduled tweets... Please wait.');
  
  const automatorDir = path.join(__dirname, '..');
  const env = Object.assign({}, process.env, { 
    IGNORE_TIME_RESTRICTION: 'true'
  });
  
  // Run the existing publish.js script
  exec('npm run publish', { cwd: automatorDir, env }, (err, stdout, stderr) => {
    if (err) {
      return ctx.editMessageText(`❌ Failed to publish:\n${err.message}\n\n${stderr}`);
    }
    
    // Automatically commit and push the changes (moved files from drafts to published)
    const repoRoot = path.join(__dirname, '..', '..');
    const patForBulk = process.env.GITHUB_PAT || '';
    const pushCmdForBulk = patForBulk ? `git push https://${patForBulk}@github.com/0-shang/yasi.git HEAD:main` : 'git push';
    exec(`git add tweets/ && git commit --allow-empty -m "bot: published from drafts folder" && ${pushCmdForBulk}`, { cwd: repoRoot }, () => {
      // Find the Twitter URLs from the stdout logs to show to the user
      const lines = stdout.split('\n');
      const urlLines = lines.filter(l => l.includes('Moved file to'));
      
      ctx.editMessageText(`✅ Successfully published ${urlLines.length} tweet(s) and synced to GitHub!\n\nOpen your Twitter to see them!`);
      
      // Trigger cross repo sync
      syncCrossRepo(ctx);
    });
  });
});

bot.action('cancel_publish', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  await ctx.answerCbQuery('Cancelled');
  await ctx.editMessageText('🚫 Cancelled publishing.');
});

async function processClippingContent(ctx, myUserId, filename, content, mode) {
  const parsed = matter(content);
  let pureContent = parsed.content.trim();
  if (pureContent.length > 5000) pureContent = pureContent.substring(0, 5000) + '... (已截断)';
  const feedText = `标题: ${filename}\n内容: ${pureContent}`;

  const isWechat = mode === 'wechat' || (mode === undefined && isWeChatMode.get(myUserId));

  if (isWechat) {
    const loadingMsg = await ctx.reply(`🔄 [公众号模式] 正在提取【${filename}】并撰写微信公众号文章，请稍候...`);
    try {
      const article = await generateWeChatArticle(feedText);
      const newMsgId = Date.now();
      pendingWechatDrafts.set(newMsgId, article);
      
      let previewContent = article.content.replace(/<[^>]*>?/gm, '');
      if (previewContent.length > 2500) previewContent = previewContent.substring(0, 2500) + '...\n\n(内容过长已截断)';
      
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        undefined,
        `✅ <b>公众号文章已生成！</b>\n\n<b>标题：</b>${article.title}\n\n<b>正文预览：</b>\n${previewContent}\n\n您想现在推送到草稿箱吗？(推送前请发送一张照片作为封面)`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('🚀 准备推送到草稿箱', `push_wechat_${newMsgId}`)],
              [Markup.button.callback('✏️ 更改文章', `edit_wechat_${newMsgId}`)],
              [Markup.button.callback('🌐 同步到我的网站博客', `sync_wechat_blog_${newMsgId}`)],
              [Markup.button.callback('❌ 取消', `cancel_wechat_${newMsgId}`)]
            ]
          }
        }
      );
    } catch (e) {
      console.error(e);
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ 生成公众号文章失败: ${e.message}`);
    }
    return;
  }

  await ctx.reply(`🔄 正在提取【${filename}】并生成推文...`);
  try {
    const aiResults = await generateTweetsFromContent(feedText, '个人收藏');
    for (let i = 0; i < aiResults.length; i++) {
      const option = aiResults[i];
      const newMsgId = Date.now() + i;
      pendingTweets.set(newMsgId, option.content);
      
      const parts = option.content.split(/\r?\n---\r?\n/);
      let preview;
      if (parts.length > 1) {
        preview = `🧵 Thread (${parts.length} 条)\n\n` + parts.map((p, idx) => `[${idx+1}/${parts.length}]\n${p.trim()}`).join('\n\n────────────\n\n');
      } else {
        preview = option.content;
      }
      
      await ctx.reply(
        `💡 Angle: ${option.angle}\n\n${preview}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🚀 发布', `post_${newMsgId}`)],
          [Markup.button.callback('🧵 转为 Thread', `thread_${newMsgId}`)],
          [Markup.button.callback('✏️ 修改', `edittweet_${newMsgId}`)],
          [Markup.button.callback('📅 定时', `schedule_${newMsgId}`)]
        ])
      );
    }
  } catch (e) {
    await ctx.reply(`❌ 生成失败: ${e.message}`);
  }
}

bot.command('clippings', async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const clippingsDir = path.join(config.paths.workspace, 'Clippings');
  if (!fs.existsSync(clippingsDir)) {
    return ctx.reply('📭 Clippings 文件夹不存在。');
  }
  
  const files = fs.readdirSync(clippingsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f, time: fs.statSync(path.join(clippingsDir, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 30)
    .map(f => f.name);

  if (files.length === 0) {
    return ctx.reply('📭 Clippings 文件夹为空。');
  }
  
  let msg = "📚 <b>本地收藏文章 (Clippings)</b>\n\n回复【数字序号】提取并生成推文/长文：\n\n";
  const cacheMap = {};
  
  files.forEach((f, index) => {
    const num = index + 1;
    cacheMap[num] = f;
    const title = f.replace('.md', '');
    msg += `<b>[${num}]</b> ${title}\n`;
  });
  
  clippingsCache.set(myUserId, cacheMap);
  activeListContext.set(myUserId, 'clippings');
  
  await ctx.reply(msg, {
    parse_mode: 'HTML'
  });
});



bot.on('text', async (ctx) => {
  if (ctx.from.id !== myUserId) return;

  const msgId = ctx.message.message_id;
  const text = ctx.message.text;

  // Intercept if we are in editing state
  if (editingState.has(myUserId)) {
    const state = editingState.get(myUserId);
    editingState.delete(myUserId); // clear state immediately
    
    if (state.type === 'file') {
      const filePath = path.join(config.paths.tweets.drafts, state.filename);
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(fileContent);
        // Replace content but keep frontmatter
        const newFileContent = matter.stringify(text, parsed.data);
        fs.writeFileSync(filePath, newFileContent, 'utf-8');
        
        // Sync the change to GitHub so it isn't lost
        const repoRoot = path.join(__dirname, '..', '..');
        exec(`git add tweets/ && git commit -m "bot: edited ${state.filename}" && git pull --rebase origin main && git push`, { cwd: repoRoot });
        
        await ctx.reply(
          `✅ File updated!\n\n📄 **Preview of ${state.filename}**\n\n${text}`, 
          Markup.inlineKeyboard([
            [Markup.button.callback('🚀 确认发布', `pubfile_${state.fileId}`)],
            [Markup.button.callback('✏️ 再次修改', `editfile_${state.fileId}`)],
            [Markup.button.callback('❌ 取消', `cancel_publish`)]
          ])
        );
      } else {
        await ctx.reply('❌ File no longer exists.');
      }
      return;
    } else if (state.type === 'tweet') {
       // Update pending tweet with original msgId (so the new edited content is saved under the old ID)
       pendingTweets.set(state.msgId, text);
       await ctx.reply(
        `✅ Tweet updated!\n\n${text}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🚀 立即发布', `post_${state.msgId}`)],
          [Markup.button.callback('🧵 转为 Thread', `thread_${state.msgId}`)],
          [Markup.button.callback('✨ AI 润色 (AI Polish)', `ai_${state.msgId}`)],
          [Markup.button.callback('📅 定时发送', `schedule_${state.msgId}`)],
          [Markup.button.callback('✏️ 再次修改', `edittweet_${state.msgId}`)],
          [Markup.button.callback('❌ 取消', `cancel_${state.msgId}`)]
        ])
      );
      return;
    } else if (state.type === 'wechat') {
       pendingWechatDrafts.set(state.msgId, { ...pendingWechatDrafts.get(state.msgId), content: text });
       const article = pendingWechatDrafts.get(state.msgId);
       let previewContent = article.content.replace(/<[^>]*>?/gm, '');
       if (previewContent.length > 2500) previewContent = previewContent.substring(0, 2500) + '...\n\n(内容过长已截断)';
       await ctx.reply(
         `✅ 公众号文章已更新！\n\n<b>标题：</b>${article.title}\n\n<b>正文预览：</b>\n${previewContent}\n\n您想现在推送到草稿箱吗？(推送前请发送一张照片作为封面)`,
         {
           parse_mode: 'HTML',
           reply_markup: {
             inline_keyboard: [
               [Markup.button.callback('🚀 准备推送到草稿箱', `push_wechat_${state.msgId}`)],
               [Markup.button.callback('✏️ 更改文章', `edit_wechat_${state.msgId}`)],
               [Markup.button.callback('🌐 同步到我的网站博客', `sync_wechat_blog_${state.msgId}`)],
               [Markup.button.callback('❌ 取消', `cancel_wechat_${state.msgId}`)]
             ]
           }
         }
       );
       return;
    }
  }

  // Check for number wakeup
  if (/^\d+$/.test(text.trim())) {
    const num = text.trim();
    const context = activeListContext.get(myUserId) || 'news';

    if (context === 'clippings') {
      const cache = clippingsCache.get(myUserId);
      if (cache && cache[num]) {
        const filename = cache[num];
        const filePath = path.join(config.paths.workspace, 'Clippings', filename);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = matter(content);
          let pureContent = parsed.content.trim();
          if (pureContent.length > 1000) pureContent = pureContent.substring(0, 1000) + '...\n\n(以下已截断)';
          
          await ctx.reply(`📄 **${filename}**\n\n${pureContent}`, {
            reply_markup: {
              inline_keyboard: [
                [Markup.button.callback('🚀 提取并生成推文', `clip_tweet_${num}`)],
                [Markup.button.callback('📝 提取并生成公众号文章', `clip_wechat_${num}`)],
                [Markup.button.callback('🗑️ 删除', `delclipping_${num}`)]
              ]
            }
          });
        } else {
           await ctx.reply(`❌ 文件不存在: ${filename}`);
        }
      }
      return;
    }

    if (context === 'news') {
      const cacheFile = path.join(config.paths.tweets.base, 'daily_news_cache.json');
      if (fs.existsSync(cacheFile)) {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        if (cache[num]) {
          const item = cache[num];
          const feedText = `Title: ${item.title}\nLink: ${item.link}\nSnippet: ${item.snippet}`;
          
          if (isWeChatMode.get(myUserId)) {
            const loadingMsg = await ctx.reply(`🔄 [公众号模式] 正在提取早报内容 [${num}] 并撰写微信公众号文章，请稍候...`);
            try {
              const article = await generateWeChatArticle(feedText);
              const newMsgId = Date.now();
              pendingWechatDrafts.set(newMsgId, article);
              
              let previewContent = article.content.replace(/<[^>]*>?/gm, '');
              if (previewContent.length > 2500) previewContent = previewContent.substring(0, 2500) + '...\n\n(内容过长已截断)';
              
              await ctx.telegram.editMessageText(
                ctx.chat.id,
                loadingMsg.message_id,
                undefined,
                `✅ <b>公众号文章已生成！</b>\n\n<b>标题：</b>${article.title}\n\n<b>正文预览：</b>\n${previewContent}\n\n您想现在推送到草稿箱吗？(推送前请发送一张照片作为封面)`,
                {
                  parse_mode: 'HTML',
                  reply_markup: {
                    inline_keyboard: [
                      [Markup.button.callback('🚀 准备推送到草稿箱', `push_wechat_${newMsgId}`)],
                      [Markup.button.callback('✏️ 更改文章', `edit_wechat_${newMsgId}`)],
                      [Markup.button.callback('🌐 同步到我的网站博客', `sync_wechat_blog_${newMsgId}`)],
                      [Markup.button.callback('❌ 取消', `cancel_wechat_${newMsgId}`)]
                    ]
                  }
                }
              );
            } catch (e) {
              console.error(e);
              await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ 生成公众号文章失败: ${e.message}`);
            }
            return;
          }

          await ctx.reply(`🔄 正在提取早报内容 [${num}] 并生成推文...`);
          try {
            const aiResults = await generateTweetsFromContent(feedText, item.category);
            for (let i = 0; i < aiResults.length; i++) {
              const option = aiResults[i];
              const newMsgId = Date.now() + i;
              pendingTweets.set(newMsgId, option.content);
              
              // Format preview: show thread parts with visual divider
              const parts = option.content.split(/\r?\n---\r?\n/);
              let preview;
              if (parts.length > 1) {
                preview = `🧵 Thread (${parts.length} 条)\n\n` + parts.map((p, idx) => `[${idx+1}/${parts.length}]\n${p.trim()}`).join('\n\n────────────\n\n');
              } else {
                preview = option.content;
              }
              
              await ctx.reply(
                `💡 Angle: ${option.angle}\n\n${preview}`,
                Markup.inlineKeyboard([
              [Markup.button.callback('🚀 发布', `post_${newMsgId}`)],
              [Markup.button.callback('🧵 转为 Thread', `thread_${newMsgId}`)],
              [Markup.button.callback('✏️ 修改', `edittweet_${newMsgId}`)],
                  [Markup.button.callback('📅 定时', `schedule_${newMsgId}`)]
                ])
              );
            }
          } catch (e) {
            await ctx.reply(`❌ 生成失败: ${e.message}`);
          }
          return;
        }
      }
    }
  }

  // Intercept URLs and fetch content
  let processingMsg = null;
  const urlRegex = /(https?:\/\/[^\s]+)/;
  if (urlRegex.test(text)) {
    processingMsg = await ctx.reply('🔄 检测到链接，正在尝试抓取网页内容，请稍候...');
  }
  
  const enrichedText = await enrichTextWithUrls(text);
  
  if (processingMsg) {
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
  }

  // Normal chat processing via Memory
  await ctx.sendChatAction('typing');
  let history = chatMemory.get(myUserId) || [];
  history.push({ role: 'user', content: enrichedText });
  
  // Keep last 10 turns (20 messages max if we include assistant)
  if (history.length > 20) history = history.slice(-20);
  
  if (isWeChatMode.get(myUserId)) {
    const loadingMsg = await ctx.reply('🔄 正在构思并撰写微信公众号文章，请稍候（通常需要1-2分钟）...');
    try {
      const article = await generateWeChatArticle(enrichedText);
      const newMsgId = Date.now();
      
      pendingWechatDrafts.set(newMsgId, article);
      
      let previewContent = article.content.replace(/<[^>]*>?/gm, '');
      if (previewContent.length > 2500) previewContent = previewContent.substring(0, 2500) + '...\n\n(内容过长已截断)';
      
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        undefined,
        `✅ <b>公众号文章已生成！</b>\n\n<b>标题：</b>${article.title}\n\n<b>正文预览：</b>\n${previewContent}\n\n您想现在推送到草稿箱吗？(推送前请发送一张照片作为封面)`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('🚀 准备推送到草稿箱', `push_wechat_${newMsgId}`)],
              [Markup.button.callback('✏️ 更改文章', `edit_wechat_${newMsgId}`)],
              [Markup.button.callback('🌐 同步到我的网站博客', `sync_wechat_blog_${newMsgId}`)],
              [Markup.button.callback('❌ 取消', `cancel_wechat_${newMsgId}`)]
            ]
          }
        }
      );
    } catch (e) {
      console.error(e);
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ 生成公众号文章失败: ${e.message}`);
    }
    return;
  }
  
  if (isChatMode.get(myUserId)) {
    try {
      const replyText = await simpleChatWithAI(history);
      history.push({ role: 'assistant', content: replyText });
      chatMemory.set(myUserId, history);
      await ctx.reply(replyText);
    } catch (e) {
      console.error(e);
      await ctx.reply(`❌ AI 处理失败: ${e.message}`);
      history.pop();
    }
    return;
  }

  try {
    const result = await chatWithAI(history);
    
    if (result.is_tweet && result.tweets && result.tweets.length > 0) {
      history.push({ role: 'assistant', content: '我为您生成了推文草稿，请查阅下方。' });
      chatMemory.set(myUserId, history);
      
      for (let i = 0; i < result.tweets.length; i++) {
        const option = result.tweets[i];
        const newMsgId = Date.now() + i;
        pendingTweets.set(newMsgId, option.content);
        
        // Format preview: show thread parts with visual divider
        const parts = option.content.split(/\r?\n---\r?\n/);
        let preview;
        if (parts.length > 1) {
          preview = `🧵 Thread (${parts.length} 条)\n\n` + parts.map((p, idx) => `[${idx+1}/${parts.length}]\n${p.trim()}`).join('\n\n────────────\n\n');
        } else {
          preview = option.content;
        }
        
        await ctx.reply(
          `💡 Angle: ${option.angle}\n\n${preview}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('🚀 发布', `post_${newMsgId}`)],
            [Markup.button.callback('✏️ 修改', `edittweet_${newMsgId}`)],
            [Markup.button.callback('📅 定时', `schedule_${newMsgId}`)]
          ])
        );
      }
    } else {
      history.push({ role: 'assistant', content: result.reply });
      chatMemory.set(myUserId, history);
      await ctx.reply(result.reply);
    }
  } catch (e) {
    console.error(e);
    await ctx.reply(`❌ AI 处理失败: ${e.message}`);
    // remove the last user message on failure
    history.pop();
  }
});

bot.action(/post_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  const text = pendingTweets.get(msgId);

  if (!text) {
    return ctx.answerCbQuery('Tweet content expired or not found.');
  }

  await ctx.answerCbQuery('Publishing to Twitter...');
  await ctx.editMessageText('⏳ Publishing to Twitter... Please wait.');

  try {
    const tweetTexts = text.split(/\r?\n---\r?\n/).map(t => t.trim()).filter(t => t.length > 0);
    const result = await postTweetOrThread(tweetTexts);
    
    saveAndSyncToGithub(text, 'published', result, null, ctx);
    pendingTweets.delete(msgId);

    await ctx.editMessageText(`✅ Published successfully!\nLink: ${result.urls[0]}`);
  } catch (error) {
    console.error(error);
    await ctx.editMessageText(`❌ Failed to publish: ${error.message}`);
  }
});

bot.action(/ai_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  const text = pendingTweets.get(msgId);

  if (!text) {
    return ctx.answerCbQuery('Tweet content expired or not found.');
  }

  await ctx.answerCbQuery('AI is thinking...');
  await ctx.editMessageText('🧠 AI is analyzing and rewriting your idea... Please wait.');

  try {
    const aiResults = await generateTweetsFromContent(text);
    await ctx.editMessageText('✨ Here are the AI-generated options based on your idea:');
    
    // Store each AI option and present it
    for (let i = 0; i < aiResults.length; i++) {
      const option = aiResults[i];
      const newMsgId = Date.now() + i; // Generate a unique ID for this generated tweet
      pendingTweets.set(newMsgId, option.content);
      
      await ctx.reply(
        `💡 **Angle**: ${option.angle}\n\n${option.content}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🚀 发布这个版本', `post_${newMsgId}`)],
          [Markup.button.callback('🧵 转为 Thread', `thread_${newMsgId}`)],
          [Markup.button.callback('✏️ 修改', `edittweet_${newMsgId}`)]
        ])
      );
    }
  } catch (error) {
    console.error(error);
    await ctx.reply(`❌ AI Generation failed: ${error.message}`);
  }
});

bot.action(/thread_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  const text = pendingTweets.get(msgId);

  if (!text) {
    return ctx.answerCbQuery('Tweet content expired or not found.');
  }

  await ctx.answerCbQuery('Converting to Thread...');
  await ctx.editMessageText('🧵 AI 正在将其重写为 Thread 格式... 请稍候。');

  try {
    const history = [{ 
      role: 'user', 
      content: `请将以下内容重新组织、扩充或拆分，强制改写为一个内容丰富的 Twitter Thread（连推）。\n要求：\n1. 必须是多条推文，段落之间用单独一行的 --- 分隔。\n2. 第一条推文必须有吸引力（Hook）。\n3. 排版必须留白，推文内部的段落或短句之间务必有空行（两次换行）。\n4. 千万不要把文字挤成一坨。\n\n原内容：\n${text}` 
    }];
    const result = await chatWithAI(history);
    
    if (result.is_tweet && result.tweets && result.tweets.length > 0) {
      await ctx.editMessageText('✨ Thread 生成完毕！请查看下方新消息。');
      
      for (let i = 0; i < result.tweets.length; i++) {
        const option = result.tweets[i];
        const newMsgId = Date.now() + i;
        pendingTweets.set(newMsgId, option.content);
        
        const parts = option.content.split(/\r?\n---\r?\n/);
        let preview;
        if (parts.length > 1) {
          preview = `🧵 Thread (${parts.length} 条)\n\n` + parts.map((p, idx) => `[${idx+1}/${parts.length}]\n${p.trim()}`).join('\n\n────────────\n\n');
        } else {
          preview = option.content;
        }
        
        await ctx.reply(
          `💡 Angle: ${option.angle}\n\n${preview}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('🚀 发布', `post_${newMsgId}`)],
            [Markup.button.callback('🧵 转为 Thread', `thread_${newMsgId}`)],
            [Markup.button.callback('✏️ 修改', `edittweet_${newMsgId}`)],
            [Markup.button.callback('📅 定时', `schedule_${newMsgId}`)]
          ])
        );
      }
    } else {
      await ctx.editMessageText(`❌ 生成 Thread 失败，AI 返回：${result.reply}`);
    }
  } catch (error) {
    console.error(error);
    await ctx.editMessageText(`❌ 生成 Thread 失败: ${error.message}`);
  }
});

bot.action(/edittweet_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  const text = pendingTweets.get(msgId);
  if (!text) return ctx.answerCbQuery('Tweet expired');

  editingState.set(myUserId, { type: 'tweet', msgId: msgId });
  await ctx.answerCbQuery();
  await ctx.reply(`✏️ **Editing Tweet**\n\nPlease copy the text below, make your changes, and send it back to me as a new message:\n\n\`\`\`text\n${text}\n\`\`\``, { parse_mode: 'Markdown' });
});

bot.action(/save_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  const text = pendingTweets.get(msgId);

  if (!text) {
    return ctx.answerCbQuery('Tweet content expired or not found.');
  }

  saveAndSyncToGithub(text, 'drafts', null);
  pendingTweets.delete(msgId);

  await ctx.answerCbQuery('Saved to drafts!');
  await ctx.editMessageText('💾 Saved to drafts folder and syncing to GitHub...');
});

bot.action(/schedule_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  const text = pendingTweets.get(msgId);

  if (!text) {
    return ctx.answerCbQuery('Tweet content expired or not found.');
  }

  const now = Date.now();
  if (lastScheduledTime < now) {
    lastScheduledTime = now;
    scheduleIntervalIndex = 0;
  }
  
  const intervalMinutes = SCHEDULE_INTERVALS[scheduleIntervalIndex];
  scheduleIntervalIndex = (scheduleIntervalIndex + 1) % SCHEDULE_INTERVALS.length;
  
  lastScheduledTime += intervalMinutes * 60 * 1000;
  const finalIsoTime = new Date(lastScheduledTime).toISOString();

  // Save to drafts so /check can see it and publish.js will pick it up
  saveAndSyncToGithub(text, 'drafts', null, finalIsoTime);
  pendingTweets.delete(msgId);

  const displayTime = new Date(lastScheduledTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  await ctx.answerCbQuery('已加入定时发布队列');
  await ctx.editMessageText(`✅ 已自动加入定时队列\n计划发送时间: ${displayTime} (北京时间)\n(已存入 drafts 文件夹，可用 /check 查看)`);
});

bot.action(/cancel_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  pendingTweets.delete(msgId);
  await ctx.answerCbQuery('Cancelled');
  await ctx.deleteMessage();
});

// ---------- WeChat Handlers ---------- //

bot.action(/cancel_wechat_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  pendingWechatDrafts.delete(msgId);
  await ctx.answerCbQuery('Cancelled');
  await ctx.deleteMessage();
});

bot.action(/push_wechat_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  const article = pendingWechatDrafts.get(msgId);

  if (!article) {
    return ctx.answerCbQuery('文章内容已过期或不存在。');
  }

  await ctx.answerCbQuery();
  const loadingMsg = await ctx.reply('🔄 正在自动提取首图作为封面，并推送到微信草稿箱...');

  try {
    let mdContent = article.content;
    
    // Find markdown images ![alt](url)
    const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s]+)\)/g;
    let match;
    const replacements = [];
    let coverBuffer = null;
    
    while ((match = imgRegex.exec(mdContent)) !== null) {
      const fullMatch = match[0];
      const altText = match[1];
      const imgUrl = match[2];
      
      try {
        console.log('Downloading image:', imgUrl);
        const imgRes = await fetch(imgUrl);
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (!coverBuffer) {
           coverBuffer = buffer;
        }

        const wechatUrl = await wechat.uploadArticleImage(buffer, 'image.jpg');
        replacements.push({ old: fullMatch, new: `![${altText}](${wechatUrl})` });
      } catch (err) {
        console.error('Failed to process image:', imgUrl, err);
      }
    }
    
    for (const rep of replacements) {
      mdContent = mdContent.replace(rep.old, rep.new);
    }
    
    // Convert to HTML
    article.htmlContent = marked.parse(mdContent);
    
    if (!coverBuffer) {
      const fallbackRes = await fetch(`https://image.pollinations.ai/prompt/abstract_finance_technology_background?width=900&height=500&nologo=true&model=flux`);
      coverBuffer = Buffer.from(await fallbackRes.arrayBuffer());
    }

    const thumbMediaId = await wechat.uploadCoverImage(coverBuffer, 'cover.jpg');
    article.thumb_media_id = thumbMediaId;

    const draftMediaId = await wechat.addDraft({
      title: article.title,
      content: article.htmlContent,
      thumb_media_id: article.thumb_media_id,
      author: 'Bot',
      digest: article.content.replace(/<[^>]+>/g, '').substring(0, 100)
    });

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      `✅ 成功推送到微信草稿箱！\n\n草稿 Media ID: \`${draftMediaId}\`\n\n您现在可以去公众号后台查看并群发了。`,
      { parse_mode: 'Markdown' }
    );

  } catch (e) {
    console.error(e);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ 推送失败: ${e.message}`);
  }
});

// ---------- End WeChat Handlers ---------- //

bot.action(/edit_wechat_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  const article = pendingWechatDrafts.get(msgId);
  if (!article) return ctx.answerCbQuery('文章已过期');

  editingState.set(myUserId, { type: 'wechat', msgId: msgId });
  await ctx.answerCbQuery();
  await ctx.reply(`✏️ **更改公众号文章**\n\n请复制下方的 Markdown 内容，修改后作为新消息发送给我：\n\n\`\`\`text\n${article.content}\n\`\`\``, { parse_mode: 'Markdown' });
});

bot.action(/sync_wechat_blog_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  const article = pendingWechatDrafts.get(msgId);

  if (!article) {
    return ctx.answerCbQuery('文章内容已过期或不存在。');
  }

  await ctx.answerCbQuery();
  const loadingMsg = await ctx.reply('⏳ 正在同步到网站博客...');

  try {
    const repoRoot = path.join(__dirname, '..', '..');
    const tempDir = path.join(repoRoot, 'temp-ai-nav-blog');
    const pat = process.env.GITHUB_PAT;
    
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    
    let cloneCmd = `git clone https://github.com/0-shang/ai-nav.git temp-ai-nav-blog`;
    if (pat) cloneCmd = `git clone https://${pat}@github.com/0-shang/ai-nav.git temp-ai-nav-blog`;
    
    exec(cloneCmd, { cwd: repoRoot }, (err) => {
      if (err) return ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, '❌ Failed to clone repo.');
      
      const dateStr = new Date().toISOString().split('T')[0];
      const safeTitle = article.title.replace(/[\/\\]/g, '-').replace(/\s+/g, '-');
      const filename = `${dateStr}-${safeTitle}.md`;
      const destDir = path.join(tempDir, 'content', 'blog');
      
      fs.mkdirSync(destDir, { recursive: true });
      
      const fileContent = `---
title: "${article.title}"
date: ${dateStr}
description: ""
---

${article.content}`;
      
      fs.writeFileSync(path.join(destDir, filename), fileContent, 'utf-8');
      
      const pushCmd = pat ? `git push https://${pat}@github.com/0-shang/ai-nav.git HEAD:master` : 'git push';
      const cmd = `git config user.name "bot" && git config user.email "bot@example.com" && git add content/blog/ && git commit -m "bot: sync wechat article to blog" && git pull --rebase origin master && ${pushCmd}`;
      
      exec(cmd, { cwd: tempDir }, (pushErr) => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        if (pushErr) {
          const safeMsg = pat ? pushErr.message.replace(new RegExp(pat, 'g'), '***') : pushErr.message;
          ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ 同步失败: ${safeMsg}`);
        } else {
          ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `✅ 已成功同步《${article.title}》到网站博客！`);
        }
      });
    });
  } catch (e) {
    console.error(e);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ 同步时出错: ${e.message}`);
  }
});


bot.action(/viewclipping_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const num = ctx.match[1];
  const cache = clippingsCache.get(myUserId);
  if (!cache || !cache[num]) return ctx.answerCbQuery('缓存已过期，请重新执行 /clippings');
  
  const filename = cache[num];
  const filePath = path.join(config.paths.workspace, 'Clippings', filename);
  if (!fs.existsSync(filePath)) return ctx.answerCbQuery('文件不存在');
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(content);
  let pureContent = parsed.content.trim();
  if (pureContent.length > 1000) pureContent = pureContent.substring(0, 1000) + '...\n\n(以下已截断)';
  
  await ctx.answerCbQuery();
  await ctx.reply(`📄 **${filename}**\n\n${pureContent}`, {
    reply_markup: {
      inline_keyboard: [
        [Markup.button.callback('🚀 提取并生成推文', `clip_tweet_${num}`)],
        [Markup.button.callback('📝 提取并生成公众号文章', `clip_wechat_${num}`)],
        [Markup.button.callback('🗑️ 删除', `delclipping_${num}`)]
      ]
    }
  });
});

bot.action(/clip_tweet_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const num = ctx.match[1];
  const cache = clippingsCache.get(myUserId);
  if (!cache || !cache[num]) return ctx.answerCbQuery('缓存已过期');
  
  const filename = cache[num];
  const filePath = path.join(config.paths.workspace, 'Clippings', filename);
  if (!fs.existsSync(filePath)) return ctx.answerCbQuery('文件不存在');
  
  const content = fs.readFileSync(filePath, 'utf-8');
  await ctx.answerCbQuery();
  await processClippingContent(ctx, myUserId, filename, content, 'tweet');
});

bot.action(/clip_wechat_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const num = ctx.match[1];
  const cache = clippingsCache.get(myUserId);
  if (!cache || !cache[num]) return ctx.answerCbQuery('缓存已过期');
  
  const filename = cache[num];
  const filePath = path.join(config.paths.workspace, 'Clippings', filename);
  if (!fs.existsSync(filePath)) return ctx.answerCbQuery('文件不存在');
  
  const content = fs.readFileSync(filePath, 'utf-8');
  await ctx.answerCbQuery();
  await processClippingContent(ctx, myUserId, filename, content, 'wechat');
});

bot.action(/delclipping_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const num = ctx.match[1];
  const cache = clippingsCache.get(myUserId);
  if (!cache || !cache[num]) return ctx.answerCbQuery('缓存已过期');
  
  const filename = cache[num];
  const filePath = path.join(config.paths.workspace, 'Clippings', filename);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
    
    const repoRoot = path.join(__dirname, '..', '..');
    const pat = process.env.GITHUB_PAT || '';
    // Must quote the filename in git rm in case of spaces
    const safeFilename = filename.replace(/(["\s'$`\\])/g,'\\$1');
    const pushCmd = pat ? `git push https://${pat}@github.com/0-shang/yasi.git HEAD:main` : 'git push';
    exec(`git rm "Clippings/${safeFilename}" && git commit -m "bot: deleted ${filename}" && git pull --rebase origin main && ${pushCmd}`, { cwd: repoRoot }, (err) => {
      if (err) console.error('Git delete sync failed:', err.message);
    });
  }

  await ctx.answerCbQuery('Deleted successfully.');
  await ctx.editMessageText(`🗑️ 已成功删除本地和 GitHub 上的收藏文章：${filename}`);
});


bot.telegram.setMyCommands([
  { command: 'daily',   description: '📰 抓取最新全矩阵早报' },
  { command: 'refetch', description: '🔄 重新抓取（全部或单板块）' },
  { command: 'news',    description: '📋 一键唤出上次早报缓存' },
  { command: 'check',   description: '🚀 检查并发布草稿队列推文' },
  { command: 'clippings', description: '📚 呼出收藏文章列表' },
  { command: 'chat',    description: '💬 切换为 闲聊模式' },
  { command: 'tweet',   description: '🐦 切换为 推文模式' },
  { command: 'mp',      description: '📝 切换为 微信公众号模式' },
  { command: 'start',   description: '🏠 回到主菜单' }
]).then(() => {
  console.log('✅ Bot commands menu set!');
}).catch(console.error);

console.log('🤖 Telegram Bot is running! You can now send messages to it in Telegram.');
bot.launch().catch(err => {
  console.error('Failed to start bot:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
