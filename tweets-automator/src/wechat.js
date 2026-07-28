const config = require('./config');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

let accessTokenCache = {
  token: null,
  expiresAt: 0
};

/**
 * Get WeChat Access Token with in-memory caching
 */
async function getAccessToken() {
  if (accessTokenCache.token && Date.now() < accessTokenCache.expiresAt) {
    return accessTokenCache.token;
  }

  const { appId, appSecret } = config.WECHAT;
  if (!appId || !appSecret || appId === 'your_wechat_app_id_here') {
    throw new Error('WeChat App ID or App Secret is not configured.');
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.errcode) {
    throw new Error(`Failed to get WeChat access token: ${data.errmsg} (Code: ${data.errcode})`);
  }

  accessTokenCache.token = data.access_token;
  // Expire 5 minutes early to be safe
  accessTokenCache.expiresAt = Date.now() + (data.expires_in - 300) * 1000;

  return accessTokenCache.token;
}

/**
 * Upload an image to WeChat and get a permanent media ID for the cover (thumb_media_id)
 * @param {Buffer} buffer - Image buffer
 * @param {string} filename - Filename with extension (e.g. cover.jpg)
 */
async function uploadCoverImage(buffer, filename) {
  const token = await getAccessToken();
  const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=image`;

  const formData = new FormData();
  formData.append('media', buffer, { filename });

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  if (data.errcode) {
    throw new Error(`Failed to upload WeChat cover image: ${data.errmsg} (Code: ${data.errcode})`);
  }

  return data.media_id;
}

/**
 * Upload an image to WeChat to get a direct URL (used inside article body)
 * @param {Buffer} buffer - Image buffer
 * @param {string} filename - Filename with extension
 */
async function uploadArticleImage(buffer, filename) {
  const token = await getAccessToken();
  const url = `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${token}`;

  const formData = new FormData();
  formData.append('media', buffer, { filename });

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  if (data.errcode) {
    throw new Error(`Failed to upload WeChat article image: ${data.errmsg} (Code: ${data.errcode})`);
  }

  return data.url; // Returns a WeChat hosted URL that can be used in <img> tags
}

/**
 * Add a new draft to WeChat
 * @param {Object} article - The article data
 * @param {string} article.title - Article title
 * @param {string} article.content - Article HTML content
 * @param {string} article.thumb_media_id - Cover image media ID
 * @param {string} article.author - Author name
 */
async function addDraft(article) {
  const token = await getAccessToken();
  const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`;

  const payload = {
    articles: [
      {
        title: article.title,
        author: article.author || 'Bot',
        content: article.content,
        thumb_media_id: article.thumb_media_id,
        need_open_comment: 0,
        only_fans_can_comment: 0
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (data.errcode) {
    throw new Error(`Failed to add WeChat draft: ${data.errmsg} (Code: ${data.errcode})`);
  }

  return data.media_id; // Draft media ID
}

module.exports = {
  getAccessToken,
  uploadCoverImage,
  uploadArticleImage,
  addDraft
};
