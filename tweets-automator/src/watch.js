const fs = require('fs');
const path = require('path');
const config = require('./config');
const matter = require('gray-matter');
const { postTweetOrThread } = require('./twitter');

// Set up directories
config.ensureDirs();

const approvedDir = config.paths.tweets.approved;
const publishedDir = config.paths.tweets.published;
const failedDir = config.paths.tweets.failed;
const logFile = path.join(config.paths.tweets.base, 'watcher.log');
const pidFile = path.join(config.paths.tweets.base, 'watcher.pid');

// Save process ID to file for safe shutdown
fs.writeFileSync(pidFile, process.pid.toString(), 'utf-8');

function log(message) {
  const timestamp = new Date().toLocaleString();
  const formattedMsg = `[${timestamp}] ${message}\n`;
  console.log(formattedMsg.trim());
  fs.appendFileSync(logFile, formattedMsg, 'utf-8');
}

// Clean up PID file on exit
process.on('exit', () => {
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
    } catch (e) {}
  }
});

// Capture termination signals
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

log('自动发布后台监控启动。监控目录: ' + approvedDir);

async function processApprovedFiles() {
  if (!fs.existsSync(approvedDir)) return;

  const files = fs.readdirSync(approvedDir).filter(f => f.endsWith('.md'));
  if (files.length === 0) return;

  log(`检测到 ${files.length} 个新批准的推文开始自动处理...`);

  for (const file of files) {
    const filePath = path.join(approvedDir, file);
    log(`正在处理推文文件: ${file}`);

    // 等待 500 毫秒以确保文件写入或移动操作已彻底完成
    await new Promise(resolve => setTimeout(resolve, 500));

    let fileContent;
    let parsed;
    try {
      fileContent = fs.readFileSync(filePath, 'utf-8');
      parsed = matter(fileContent);
    } catch (err) {
      log(`- 读取或解析文件失败 "${file}": ${err.message}`);
      continue;
    }

    const { data: frontmatter, content: body } = parsed;
    const tweetTexts = body
      .split(/\r?\n---\r?\n/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (tweetTexts.length === 0) {
      log(`- 警告: 文件 "${file}" 并没有推文正文内容，跳过。`);
      continue;
    }

    try {
      log(`- 正在向 Twitter/X 发送 ${tweetTexts.length} 条推文...`);
      const result = await postTweetOrThread(tweetTexts);
      log(`- 发布成功! 首条推文 ID: ${result.id}`);

      // 更新 YAML 元数据
      const updatedFrontmatter = {
        ...frontmatter,
        status: 'published',
        published_at: new Date().toISOString(),
        tweet_id: result.id,
        urls: result.urls
      };

      const newFileContent = matter.stringify(body, updatedFrontmatter);
      fs.writeFileSync(path.join(publishedDir, file), newFileContent, 'utf-8');
      fs.unlinkSync(filePath);
      log(`- 归档完成，已移至 tweets/published/${file}`);
    } catch (err) {
      log(`- 发布失败 "${file}": ${err.message}`);

      // 失败后标记原因，并移动到 failed 文件夹
      const updatedFrontmatter = {
        ...frontmatter,
        status: 'failed',
        last_error: err.message,
        failed_at: new Date().toISOString()
      };

      const newFileContent = matter.stringify(body, updatedFrontmatter);
      fs.writeFileSync(path.join(failedDir, file), newFileContent, 'utf-8');
      fs.unlinkSync(filePath);
      log(`- 已移至错误反馈文件夹 tweets/failed/${file}`);
    }
  }
}

// 每 5 秒轮询一次 approved 文件夹
setInterval(async () => {
  try {
    await processApprovedFiles();
  } catch (err) {
    log('轮询循环中遇到错误: ' + err.message);
  }
}, 5000);
