const fs = require('fs');
const path = require('path');
const config = require('./config');
const readline = require('readline');
const { generateTweetsFromContent, generateWeChatArticle } = require('./ai');

async function runClippings() {
  const clippingsDir = path.join(config.paths.workspace, 'Clippings');
  if (!fs.existsSync(clippingsDir)) {
    console.log('📭 Clippings 文件夹不存在。');
    return;
  }
  
  const files = fs.readdirSync(clippingsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f, time: fs.statSync(path.join(clippingsDir, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 30)
    .map(f => f.name);

  if (files.length === 0) {
    console.log('📭 Clippings 文件夹为空。');
    return;
  }

  console.log("\n📚 本地收藏文章 (Clippings)\n");
  files.forEach((f, index) => {
    console.log(`[${index + 1}] ${f.replace('.md', '')}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\n请输入要提取的序号 (输入 0 退出): ', (answer) => {
    const num = parseInt(answer.trim(), 10);
    if (isNaN(num) || num < 1 || num > files.length) {
      console.log('已退出或输入无效。');
      rl.close();
      return;
    }

    const filename = files[num - 1];
    const filePath = path.join(clippingsDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    console.log(`\n📄 选择了: ${filename}`);
    
    rl.question('\n请选择生成类型:\n[1] 生成推文草稿 (Twitter/X)\n[2] 生成微信公众号排版长文\n请选择 (1或2): ', async (type) => {
      rl.close();
      
      try {
        if (type === '1') {
          console.log(`\n⏳ 正在分析内容并生成推文草稿...`);
          const tweets = await generateTweetsFromContent(content);
          
          if (!tweets || tweets.length === 0) {
            console.log("❌ 未能生成任何推文。");
            return;
          }

          console.log(`\n✅ 成功生成 ${tweets.length} 条推文草稿！`);
          
          const draftsDir = config.paths.tweets.drafts;
          if (!fs.existsSync(draftsDir)) fs.mkdirSync(draftsDir, { recursive: true });
          
          const dateStr = new Date().toISOString().split('T')[0];
          const baseName = filename.replace('.md', '').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').slice(0, 30);
          
          tweets.forEach((tweet, i) => {
            const draftFileName = `${dateStr}_${baseName}_${i + 1}.md`;
            const draftFilePath = path.join(draftsDir, draftFileName);
            
            const fileContent = `---\nsource: "Clippings/${filename}"\ngenerated_at: "${new Date().toISOString()}"\nstatus: "draft"\nangle: "${tweet.angle.replace(/"/g, '\\"')}"\n---\n\n${tweet.content}\n`;
            
            fs.writeFileSync(draftFilePath, fileContent, 'utf-8');
            console.log(`- 已保存至: tweets/drafts/${draftFileName} (角度: ${tweet.angle})`);
          });
          
        } else if (type === '2') {
          console.log(`\n⏳ 正在构思和撰写公众号文章，并自动配图中...`);
          const article = await generateWeChatArticle(content);
          
          const outDir = path.join(__dirname, '..', 'articles');
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          
          const outFilename = path.join(outDir, `Article_${Date.now()}.md`);
          const finalMarkdown = `# ${article.title}\n\n${article.content}`;
          
          fs.writeFileSync(outFilename, finalMarkdown, 'utf-8');
          console.log(`\n✅ 文章生成完毕！已保存至：${outFilename}`);
          
        } else {
          console.log('❌ 无效的选择。');
        }
      } catch (err) {
        console.error("❌ 生成失败:", err);
      }
    });
  });
}

runClippings();
