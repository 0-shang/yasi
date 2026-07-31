require('dotenv').config();
const { generateWeChatArticle } = require('./src/ai');
const fs = require('fs');
const path = require('path');

async function run() {
  const topic = process.argv[2];
  if (!topic) {
    console.log("❌ 请提供一个主题！\n👉 示例: node generate-article.js 'AI将如何改变未来的工作方式'");
    process.exit(1);
  }

  console.log(`⏳ 正在构思和撰写关于【${topic}】的公众号文章，并自动配图中...`);
  try {
    const article = await generateWeChatArticle(topic);
    
    // 如果没有输出文件夹，新建一个
    const outDir = path.join(__dirname, 'articles');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }

    const filename = path.join(outDir, `Article_${Date.now()}.md`);
    
    const finalMarkdown = `# ${article.title}\n\n${article.content}`;
    
    fs.writeFileSync(filename, finalMarkdown, 'utf-8');
    console.log(`✅ 文章生成完毕！已保存至：${filename}`);
  } catch (error) {
    console.error("❌ 生成失败:", error);
  }
}

run();
