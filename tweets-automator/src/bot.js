require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { exec } = require('child_process');
const config = require('./config');
const { postTweetOrThread } = require('./twitter');
const { generateTweetsFromContent, generateHotTweetsFromRSS, chatWithAI } = require('./ai');
const Parser = require('rss-parser');
const parser = new Parser();

// Setup environment and paths
config.ensureDirs();
const publishedDir = config.paths.tweets.published;
const draftsDir = config.paths.tweets.drafts;

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const myUserId = parseInt(process.env.TELEGRAM_USER_ID, 10);

if (!botToken || !myUserId) {
  console.error("Please set TELEGRAM_BOT_TOKEN and TELEGRAM_USER_ID in your .env file.");
  process.exit(1);
}

const bot = new Telegraf(botToken);

// In-memory store for pending tweets
const pendingTweets = new Map();
// In-memory store for pending files from GitHub
const checkPendingFiles = new Map();
// In-memory store for edit state
const editingState = new Map();
// In-memory store for conversational chat
const chatMemory = new Map();

// Helper: Save to markdown file and sync to github
function saveAndSyncToGithub(content, type = 'published', tweetResult = null, scheduleTime = null) {
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = Date.now().toString().slice(-6); // Just for uniqueness
  const filename = `${dateStr}_tg_bot_${timeStr}.md`;
  
  const targetDir = type === 'published' ? publishedDir : draftsDir;
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
  exec(`git add tweets/ && git commit -m "bot: auto saved ${type} tweet" && git pull --rebase origin main && git push`, { cwd: repoRoot }, (err, stdout, stderr) => {
    if (err) {
      console.error('Git sync failed:', err);
    } else {
      console.log('Git sync success.');
      if (type === 'published') {
        syncCrossRepo();
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
  const destDir = path.join(tempDir, 'content', 'insights', 'feed');
  
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
    
    // Commit and push
    const cmd = `git config user.name "bot" && git config user.email "bot@example.com" && git add content/insights/feed/ && git commit -m "bot: auto-sync published tweets" && git push`;
    exec(cmd, { cwd: tempDir }, () => {
      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (ctx) ctx.reply('✅ Successfully synced cross-repository to ai-nav!');
    });
  });
}

bot.start((ctx) => {
  if (ctx.from.id !== myUserId) {
    return ctx.reply("Sorry, you are not authorized to use this bot.");
  }
  ctx.reply("👋 Welcome! Send me any text, and I will help you post it to Twitter/X.\n\nTips:\n- Use `---` to separate paragraphs into a Twitter Thread.\n- Send /check to read your GitHub 'approved' folder and publish pending tweets!\n- Send /rss to fetch today's RSS feed and generate 10 hot tweet ideas.");
});

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
          [Markup.button.callback('✏️ 修改', `edittweet_${newMsgId}`)],
          [Markup.button.callback('💾 存为草稿', `save_${newMsgId}`)],
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
    
    // Scan approved directory
    let files = [];
    if (fs.existsSync(config.paths.tweets.approved)) {
      files = fs.readdirSync(config.paths.tweets.approved).filter(f => f.endsWith('.md'));
    }
    
    if (files.length === 0) {
      return ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, '📭 No pending tweets found in the "approved" folder.');
    }
    
    ctx.telegram.editMessageText(
      ctx.chat.id, 
      loadingMsg.message_id, 
      undefined,
      `📦 Found ${files.length} pending tweet(s) in "approved" folder.\nSelect a file to preview/publish:`,
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

  const filePath = path.join(config.paths.tweets.approved, filename);
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
      [Markup.button.callback('❌ 返回', `cancel_publish`)]
    ])
  );
});

bot.action(/editfile_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const fileId = parseInt(ctx.match[1], 10);
  const filename = checkPendingFiles.get(fileId);
  
  if (!filename) return ctx.answerCbQuery('File session expired.');

  const filePath = path.join(config.paths.tweets.approved, filename);
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
    
    // Automatically commit and push the changes (moved files from approved to published)
    const repoRoot = path.join(__dirname, '..', '..');
    exec(`git add tweets/ && git commit -m "bot: published ${filename}" && git pull --rebase origin main && git push`, { cwd: repoRoot }, () => {
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
  await ctx.editMessageText('⏳ Publishing all approved tweets... Please wait.');
  
  const automatorDir = path.join(__dirname, '..');
  const env = Object.assign({}, process.env, { 
    IGNORE_TIME_RESTRICTION: 'true'
  });
  
  // Run the existing publish.js script
  exec('npm run publish', { cwd: automatorDir, env }, (err, stdout, stderr) => {
    if (err) {
      return ctx.editMessageText(`❌ Failed to publish:\n${err.message}\n\n${stderr}`);
    }
    
    // Automatically commit and push the changes (moved files from approved to published)
    const repoRoot = path.join(__dirname, '..', '..');
    exec(`git add tweets/ && git commit -m "bot: published from approved folder" && git pull --rebase origin main && git push`, { cwd: repoRoot }, () => {
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

bot.on('text', async (ctx) => {
  if (ctx.from.id !== myUserId) return;

  const msgId = ctx.message.message_id;
  const text = ctx.message.text;

  // Intercept if we are in editing state
  if (editingState.has(myUserId)) {
    const state = editingState.get(myUserId);
    editingState.delete(myUserId); // clear state immediately
    
    if (state.type === 'file') {
      const filePath = path.join(config.paths.tweets.approved, state.filename);
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
          [Markup.button.callback('✨ AI 润色 (AI Polish)', `ai_${state.msgId}`)],
          [Markup.button.callback('💾 存为草稿', `save_${state.msgId}`)],
          [Markup.button.callback('📅 定时发送', `schedule_${state.msgId}`)],
          [Markup.button.callback('✏️ 再次修改', `edittweet_${state.msgId}`)],
          [Markup.button.callback('❌ 取消', `cancel_${state.msgId}`)]
        ])
      );
      return;
    } else if (state.type === 'schedule') {
      const pendingText = pendingTweets.get(state.msgId);
      if (!pendingText) {
        return ctx.reply('❌ 找不到对应的推文内容，可能已过期。');
      }
      // Check if text looks like a time
      saveAndSyncToGithub(pendingText, 'draft', null, text);
      pendingTweets.delete(state.msgId);
      await ctx.reply(`✅ 已加入定时队列，计划发送时间: ${text}\n(将存入 drafts 并标记 approved)`);
      return;
    }
  }

  // Check for number wakeup (daily news)
  if (/^\d+$/.test(text.trim())) {
    const num = text.trim();
    const cacheFile = path.join(config.paths.tweets.base, 'daily_news_cache.json');
    if (fs.existsSync(cacheFile)) {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      if (cache[num]) {
        const item = cache[num];
        await ctx.reply(`🔄 正在提取早报内容 [${num}] 并生成推文...`);
        const feedText = `Title: ${item.title}\nLink: ${item.link}\nSnippet: ${item.snippet}`;
        try {
          const aiResults = await generateTweetsFromContent(feedText);
          for (let i = 0; i < aiResults.length; i++) {
            const option = aiResults[i];
            const newMsgId = Date.now() + i;
            pendingTweets.set(newMsgId, option.content);
            await ctx.reply(
              `💡 **Angle**: ${option.angle}\n\n${option.content}`,
              Markup.inlineKeyboard([
                [Markup.button.callback('🚀 发布', `post_${newMsgId}`)],
                [Markup.button.callback('✏️ 修改', `edittweet_${newMsgId}`)],
                [Markup.button.callback('💾 草稿', `save_${newMsgId}`)],
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

  // Normal chat processing via Memory
  await ctx.sendChatAction('typing');
  let history = chatMemory.get(myUserId) || [];
  history.push({ role: 'user', content: text });
  
  // Keep last 10 turns (20 messages max if we include assistant)
  if (history.length > 20) history = history.slice(-20);
  
  try {
    const result = await chatWithAI(history);
    
    if (result.is_tweet && result.tweets && result.tweets.length > 0) {
      history.push({ role: 'assistant', content: '我为您生成了推文草稿，请查阅下方。' });
      chatMemory.set(myUserId, history);
      
      for (let i = 0; i < result.tweets.length; i++) {
        const option = result.tweets[i];
        const newMsgId = Date.now() + i;
        pendingTweets.set(newMsgId, option.content);
        await ctx.reply(
          `💡 **Angle**: ${option.angle}\n\n${option.content}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('🚀 发布', `post_${newMsgId}`)],
            [Markup.button.callback('✏️ 修改', `edittweet_${newMsgId}`)],
            [Markup.button.callback('💾 草稿', `save_${newMsgId}`)],
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
    
    saveAndSyncToGithub(text, 'published', result);
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
          [Markup.button.callback('✏️ 修改', `edittweet_${newMsgId}`)],
          [Markup.button.callback('💾 存为草稿', `save_${newMsgId}`)]
        ])
      );
    }
  } catch (error) {
    console.error(error);
    await ctx.reply(`❌ AI Generation failed: ${error.message}`);
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

  saveAndSyncToGithub(text, 'draft', null);
  pendingTweets.delete(msgId);

  await ctx.answerCbQuery('Saved as draft!');
  await ctx.editMessageText('💾 Saved to local draft folder and syncing to GitHub...');
});

bot.action(/schedule_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  const text = pendingTweets.get(msgId);

  if (!text) {
    return ctx.answerCbQuery('Tweet content expired or not found.');
  }

  editingState.set(myUserId, { type: 'schedule', msgId: msgId });
  await ctx.answerCbQuery();
  await ctx.reply('📅 **设置定时发送**\n\n请直接回复我想发送的时间（格式建议：`2026-06-26 15:30`，或者直接输入 `明天上午10点` 等，格式不限只要发布脚本能懂即可，建议用标准时间格式）。');
});

bot.action(/cancel_(.+)/, async (ctx) => {
  if (ctx.from.id !== myUserId) return;
  const msgId = parseInt(ctx.match[1], 10);
  pendingTweets.delete(msgId);
  await ctx.answerCbQuery('Cancelled');
  await ctx.deleteMessage();
});

console.log('🤖 Telegram Bot is running! You can now send messages to it in Telegram.');
bot.launch().catch(err => {
  console.error('Failed to start bot:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
