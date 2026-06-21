const path = require('path');
const fs = require('fs');

// Load environment variables from .env file in the project root
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  // Try loading from current working dir as fallback
  require('dotenv').config();
}

// Configuration options
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;

// Resolve workspaces and tweets directories
const baseDir = path.resolve(__dirname, '..');
const workspacePath = path.resolve(baseDir, process.env.WORKSPACE_PATH || '../');
const tweetsBaseDir = path.resolve(baseDir, process.env.TWEETS_DIR || '../tweets/');

const tweetsDir = {
  base: tweetsBaseDir,
  drafts: path.join(tweetsBaseDir, 'drafts'),
  approved: path.join(tweetsBaseDir, 'approved'),
  published: path.join(tweetsBaseDir, 'published'),
  failed: path.join(tweetsBaseDir, 'failed'),
  stateFile: path.join(tweetsBaseDir, 'state.json')
};

// Function to ensure all directories exist
function ensureDirs() {
  const dirs = [
    tweetsDir.base,
    tweetsDir.drafts,
    tweetsDir.approved,
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
  TWITTER: {
    apiKey: TWITTER_API_KEY,
    apiSecret: TWITTER_API_SECRET,
    accessToken: TWITTER_ACCESS_TOKEN,
    accessSecret: TWITTER_ACCESS_SECRET
  },
  paths: {
    workspace: workspacePath,
    tweets: tweetsDir
  },
  ensureDirs
};
