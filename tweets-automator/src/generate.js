const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { generateTweetsFromContent } = require('./ai');

// Set up directories
config.ensureDirs();

const stateFile = config.paths.tweets.stateFile;
const draftsDir = config.paths.tweets.drafts;
const workspaceDir = config.paths.workspace;

// Read state
let state = { processedFiles: {} };
if (fs.existsSync(stateFile)) {
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  } catch (err) {
    console.error('Error reading state file, resetting state:', err.message);
  }
}
if (!state.processedFiles) state.processedFiles = {};

// Helper to recursively get markdown files
function getMarkdownFiles(dir, excludeList = []) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (e) {
      return; // Skip files that we can't stat
    }
    
    if (stat && stat.isDirectory()) {
      const baseName = path.basename(filePath);
      // Skip hidden directories and excluded folders
      if (baseName.startsWith('.') || excludeList.includes(baseName) || excludeList.some(ex => filePath.includes(ex))) {
        return;
      }
      results = results.concat(getMarkdownFiles(filePath, excludeList));
    } else if (filePath.endsWith('.md')) {
      results.push(filePath);
    }
  });
  return results;
}

// Main execution
async function main() {
  console.log('=== Starting Twitter Draft Generation ===');
  console.log('Workspace directory:', workspaceDir);
  console.log('Drafts directory:', draftsDir);
  
  // Folders to exclude from scanning
  const excludeFolders = [
    'node_modules',
    '.git',
    '.obsidian',
    '.trash',
    '_templates',
    'tweets',
    'tweets-automator'
  ];

  const files = getMarkdownFiles(workspaceDir, excludeFolders);
  console.log(`Found ${files.length} markdown files in workspace.`);

  let newOrModifiedFiles = [];
  
  for (const file of files) {
    const relativePath = path.relative(workspaceDir, file);
    
    // Calculate MD5 hash of the file content instead of using mtime
    // Because Git doesn't preserve mtime, so mtime changes on every GitHub Action run!
    const fileContent = fs.readFileSync(file, 'utf-8');
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileContent);
    const contentHash = hashSum.digest('hex');
    
    const processedInfo = state.processedFiles[relativePath];
    
    if (!processedInfo || processedInfo.hash !== contentHash) {
      newOrModifiedFiles.push({
        absolutePath: file,
        relativePath,
        contentHash,
        fileContent // pass it down so we don't read it again
      });
    }
  }

  if (newOrModifiedFiles.length === 0) {
    console.log('No new or modified markdown files found. All files are up to date.');
    return;
  }

  console.log(`Found ${newOrModifiedFiles.length} new/modified file(s) to process.`);

  for (const fileItem of newOrModifiedFiles) {
    console.log(`\nProcessing: "${fileItem.relativePath}"...`);
    try {
      const fileContent = fileItem.fileContent;
      if (fileContent.trim().length < 10) {
        console.log('File content too short, skipping.');
        continue;
      }

      const tweets = await generateTweetsFromContent(fileContent);
      console.log(`Generated ${tweets.length} draft tweet(s).`);

      const dateStr = new Date().toISOString().split('T')[0];
      const baseName = path.basename(fileItem.relativePath, '.md')
        .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')
        .slice(0, 30); // Limit name length to keep files clean

      for (let i = 0; i < tweets.length; i++) {
        const tweet = tweets[i];
        const draftFileName = `${dateStr}_${baseName}_${i + 1}.md`;
        const draftFilePath = path.join(draftsDir, draftFileName);

        const fileContent = `---
source: "${fileItem.relativePath.replace(/\\/g, '/')}"
generated_at: "${new Date().toISOString()}"
status: "draft"
angle: "${tweet.angle.replace(/"/g, '\\"')}"
---

${tweet.content}
`;

        fs.writeFileSync(draftFilePath, fileContent, 'utf-8');
        console.log(`- Created draft: tweets/drafts/${draftFileName}`);
      }

      // Update state
      state.processedFiles[fileItem.relativePath] = {
        hash: fileItem.contentHash,
        lastProcessedAt: new Date().toISOString()
      };
      
      // Save state immediately
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');

    } catch (err) {
      console.error(`Failed to process "${fileItem.relativePath}":`, err.message);
    }
  }

  console.log('\n=== Generation Complete ===');
}

main().catch(err => {
  console.error('Fatal error during generation:', err);
});
