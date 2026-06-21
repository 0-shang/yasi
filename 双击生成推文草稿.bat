@echo off
echo ==========================================
echo 正在扫描新笔记并生成推文草稿...
echo ==========================================
cd /d "%~dp0"
cd tweets-automator
node src/generate.js
echo ==========================================
echo 处理完成，请在 Obsidian 的 tweets/drafts 目录中审核。
echo ==========================================
pause
