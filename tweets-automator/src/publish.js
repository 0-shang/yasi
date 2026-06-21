const fs = require('fs');
const path = require('path');
const config = require('./config');
const matter = require('gray-matter');
const { postTweetOrThread } = require('./twitter');

// Set up directories
config.ensureDirs();

const draftsDir = config.paths.tweets.drafts;
const approvedDir = config.paths.tweets.approved;
const publishedDir = config.paths.tweets.published;
const failedDir = config.paths.tweets.failed;

async function main() {
  console.log('=== Starting Twitter Publishing Process ===');
  console.log('Approved directory:', approvedDir);
  console.log('Drafts directory (checking for "approved" status):', draftsDir);

  const approvedFiles = [];

  // 1. Scan approved/ folder for markdown files
  if (fs.existsSync(approvedDir)) {
    const files = fs.readdirSync(approvedDir);
    files.forEach(file => {
      if (file.endsWith('.md')) {
        approvedFiles.push({
          absolutePath: path.join(approvedDir, file),
          filename: file,
          origin: 'approved_folder'
        });
      }
    });
  }

  // 2. Scan drafts/ folder for files with status: "approved" in frontmatter
  if (fs.existsSync(draftsDir)) {
    const files = fs.readdirSync(draftsDir);
    files.forEach(file => {
      if (file.endsWith('.md')) {
        const filePath = path.join(draftsDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = matter(content);
          if (parsed.data && parsed.data.status === 'approved') {
            approvedFiles.push({
              absolutePath: filePath,
              filename: file,
              origin: 'drafts_folder'
            });
          }
        } catch (e) {
          // Ignore files that fail to parse
        }
      }
    });
  }

  // Sort approvedFiles alphabetically by filename to ensure oldest/earliest is processed first
  approvedFiles.sort((a, b) => a.filename.localeCompare(b.filename));

  const maxTweets = process.env.MAX_TWEETS_PER_RUN ? parseInt(process.env.MAX_TWEETS_PER_RUN, 10) : Infinity;
  const filesToPublish = approvedFiles.slice(0, maxTweets);

  console.log(`Found ${approvedFiles.length} approved tweet(s) in queue. Will publish ${filesToPublish.length} tweet(s) in this run.\n`);

  for (const fileItem of filesToPublish) {
    console.log(`Publishing: "${fileItem.filename}" (from ${fileItem.origin})...`);
    
    let fileContent;
    let parsed;
    try {
      fileContent = fs.readFileSync(fileItem.absolutePath, 'utf-8');
      parsed = matter(fileContent);
    } catch (err) {
      console.error(`- Error reading/parsing file: ${err.message}`);
      continue;
    }

    const { data: frontmatter, content: body } = parsed;
    
    // Split the body by line-level '---' to detect threads
    const tweetTexts = body
      .split(/\r?\n---\r?\n/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (tweetTexts.length === 0) {
      console.error('- Tweet body is empty, skipping.');
      continue;
    }

    try {
      console.log(`- Sending ${tweetTexts.length} tweet(s) to Twitter/X...`);
      const result = await postTweetOrThread(tweetTexts);
      console.log(`- Successfully published! ID: ${result.id}`);
      
      // Update frontmatter
      const updatedFrontmatter = {
        ...frontmatter,
        status: 'published',
        published_at: new Date().toISOString(),
        tweet_id: result.id,
        urls: result.urls
      };

      // Stringify back to markdown
      const newFileContent = matter.stringify(body, updatedFrontmatter);
      
      // Write to published folder
      const targetPath = path.join(publishedDir, fileItem.filename);
      fs.writeFileSync(targetPath, newFileContent, 'utf-8');
      console.log(`- Moved file to: tweets/published/${fileItem.filename}`);

      // Delete the original file
      fs.unlinkSync(fileItem.absolutePath);

    } catch (err) {
      console.error(`- Failed to publish: ${err.message}`);

      // Update frontmatter with failure info
      const updatedFrontmatter = {
        ...frontmatter,
        status: 'failed',
        last_error: err.message,
        failed_at: new Date().toISOString()
      };

      const newFileContent = matter.stringify(body, updatedFrontmatter);
      
      // Write to failed folder
      const targetPath = path.join(failedDir, fileItem.filename);
      fs.writeFileSync(targetPath, newFileContent, 'utf-8');
      console.log(`- Moved file to: tweets/failed/${fileItem.filename}`);

      // Delete the original file
      fs.unlinkSync(fileItem.absolutePath);
    }
  }

  console.log('\n=== Publishing Process Complete ===');
}

main().catch(err => {
  console.error('Fatal error during publishing:', err);
});
