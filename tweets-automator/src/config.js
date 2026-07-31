const path = require('path');
const fs = require('fs');

// 优先从用户执行命令的当前目录读取 .env
const cwdEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(cwdEnvPath)) {
  require('dotenv').config({ path: cwdEnvPath });
} else {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  } else {
    require('dotenv').config();
  }
}

// Configuration options
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

// Auto-detect provider based on credentials
const AI_PROVIDER = process.env.AI_PROVIDER || 
  (DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'your_deepseek_api_key_here' ? 'deepseek' : 'gemini');

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;

const WECHAT_APP_ID = process.env.WECHAT_APP_ID;
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

const RSS_FEED_URL = process.env.RSS_FEED_URL || 'https://news.ycombinator.com/rss';

// Resolve workspaces and tweets directories relative to user's current working directory
const workspacePath = path.resolve(process.cwd(), process.env.WORKSPACE_PATH || './');
const tweetsBaseDir = path.resolve(process.cwd(), process.env.TWEETS_DIR || './tweets/');

const tweetsDir = {
  base: tweetsBaseDir,
  drafts: path.join(tweetsBaseDir, 'drafts'),
  published: path.join(tweetsBaseDir, 'published'),
  failed: path.join(tweetsBaseDir, 'failed'),
  stateFile: path.join(tweetsBaseDir, 'state.json')
};

// Function to ensure all directories exist
function ensureDirs() {
  const dirs = [
    tweetsDir.base,
    tweetsDir.drafts,
    tweetsDir.published,
    tweetsDir.failed
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Ensure state file exists with empty JSON object if not present
  if (!fs.existsSync(tweetsDir.stateFile)) {
    fs.writeFileSync(tweetsDir.stateFile, JSON.stringify({ processedFiles: {} }, null, 2), 'utf-8');
  }
}

module.exports = {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  DEEPSEEK_API_KEY,
  DEEPSEEK_MODEL,
  AI_PROVIDER,
  RSS_FEED_URL,
  PEXELS_API_KEY,
  TWITTER: {
    apiKey: TWITTER_API_KEY,
    apiSecret: TWITTER_API_SECRET,
    accessToken: TWITTER_ACCESS_TOKEN,
    accessSecret: TWITTER_ACCESS_SECRET
  },
  WECHAT: {
    appId: WECHAT_APP_ID,
    appSecret: WECHAT_APP_SECRET
  },
  paths: {
    workspace: workspacePath,
    tweets: tweetsDir
  },
  ensureDirs
};
// Trigger workflow run

