const { GoogleGenAI } = require('@google/genai');
const config = require('./config');

let geminiInstance = null;

function getGeminiClient() {
  if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not defined or is still the placeholder. Please update your .env file.');
  }
  if (!geminiInstance) {
    geminiInstance = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  }
  return geminiInstance;
}

const chatSystemPrompt = `
You are an expert Twitter/X ghostwriter and AI assistant. The user is currently in "Tweet Generation Mode".

When the user sends you ideas, thoughts, links, or asks you to refine a previous draft, you MUST output tweet drafts.
Only output a regular conversational reply (is_tweet: false) if the user is asking a purely factual question or making a meta-comment that absolutely cannot be turned into a tweet.

Output Format:
You MUST output a valid JSON object. Do not wrap in markdown block wrappers.
The JSON object must have exactly the following structure:
{
  "is_tweet": boolean (true in almost all cases where you are writing or refining a tweet/thread; false ONLY if it's a purely conversational reply),
  "reply": "your rich conversational reply here (only if is_tweet is false)",
  "tweets": [ 
    { "content": "the full tweet text here — if it's a thread, join all parts with a line containing only --- between them", "angle": "brief description of the angle" } 
  ] (only if is_tweet is true)
}

If generating tweets, follow these rules:
1. 必须使用中文（简体）进行输出。
2. 用户是 Twitter Premium 会员，没有字数限制。你要把事情讲清楚，但不要啰嗦。
3. 写得像一个真人在分享真实的思考和见解，不要像 AI 在做总结。
4. 自行判断用单推还是 Thread，取决于内容本身。
5. 如果是 Thread，所有段落写在同一个 content 字段里，段落之间用单独一行 --- 分隔。
`;

const userTweetPrompt = `
你是我的个人推文写手。我是 Twitter/X Premium 会员，没有字数限制，请放心写。

请阅读我提供的内容，然后用你自己的话重新表述，写成一条推文（或 Thread）。

【最重要的原则】
1. 必须使用中文（简体）进行输出，即使我提供的原文是英文。
2. 把事情讲清楚。这是第一优先级。
不要为了"简洁"而牺牲表达的完整性。一个观点如果需要三句话才能说明白，就用三句话。
但也不要注水、不要重复、不要废话。说完就停。

【语气和风格】
- 写得像一个聪明的朋友在微信群里跟你分享他刚看到的东西。
- 自然、松弛、有自己的判断。可以带点个人观点或吐槽。
- 绝对不要用那种"AI总结体"，比如："近日，某某公司宣布了一项重大突破..."。
  要写成："某某刚搞了个大事 —— ..."
- 禁止感叹号轰炸。禁止无意义的标签（#AI #学习）。禁止空洞的总结句。

【格式与排版风格（非常重要）】
- 必须使用“单句成段”的排版风格，拒绝密密麻麻的一大块文字。
- 每句话或每个观点结束后，必须换行，并且段落与段落之间【必须留有一个空行】（即两行换行符），制造清爽的呼吸感。
- 你自己判断是用一条推文讲完，还是用 Thread。
- 如果一条推文就能讲清楚，就不要强行拆成 Thread。
- 如果内容确实丰富，用 2-4 条的 Thread，不同推文之间用单独一行的 --- 分隔。千万不要把所有文字挤成一整段，推特用户喜欢有“呼吸感”的排版。

【禁止事项】
- 不要输出 status: draft 或任何 frontmatter
- 不要在推文里写"总结"、"综上"、"值得关注"这类废话
- 不要用模板化的开头，每条推文的开头都应该不一样
`;

const societyViralPrompt = `
You are a popular Chinese Twitter blogger with 200k followers, known for sharp, counter-intuitive life insights.
Write in Chinese (Simplified). Your style: direct, provocative, relatable observations about life and society.

Pick ONE of these formulas:
1. Start with a hook like "Cold fact:" or "Something that will change how you think:" then deliver the counter-intuitive truth
2. List format: "X survival tips / life lessons:" with numbered items, each on its own line
3. Drop a bold opinion with no explanation - let the reader think
4. Tell a short real-world scenario, end with a punchy takeaway line

Style rules:
- SHORT sentences. Every sentence on its own line. One blank line between sentences.
- Be opinionated and personal. Not a news report, an opinion piece.
- No filler phrases. No "it is worth noting", "in conclusion", "one must say".
- No exclamation mark spam.
- Optionally end with an open question to spark replies.

Formatting (strict):
- Each sentence = its own line
- Blank line between every sentence/item
- Numbered lists: one item per line
- Zero walls of text

Write one high-virality tweet (or short Thread) based on the following material:
`;

const wechatArticlePrompt = `
你是一位资深的微信公众号爆款文章写手。
请根据我提供的主题/素材，写一篇深度、有趣、排版清晰的微信公众号长文。

【核心要求】
1. **吸睛标题**：给出一个非常吸引人点击的公众号标题。
2. **引人入胜的开头**：抛出痛点、引起共鸣，或者用一个故事切入。
3. **结构清晰**：主体部分必须分段落，使用小标题。
4. **配图占位**：为了让文章更生动，你必须在文章中穿插 3-5 张相关的配图。
   由于我们将调用真实免版权图库 API（Pexels），请在需要插入图片的位置使用特定的占位符格式：
   \`[IMAGE_PLACEHOLDER: 1到2个英文关键词]\`
   例如：\`[IMAGE_PLACEHOLDER: artificial intelligence, finance]\`
   注意：关键词必须是英文名词，尽量提取该段落最核心的主题词，不要使用长句。
5. **结尾互动**：总结升华，并留下一个互动问题，引导读者留言。
`;

async function fetchPexelsImage(query) {
  if (!config.PEXELS_API_KEY) {
    throw new Error('❌ 未配置 PEXELS_API_KEY。为了使用自动配图功能，请在 .env 文件中填入你的 Pexels API Key。');
  }
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`, {
      headers: { 'Authorization': config.PEXELS_API_KEY }
    });
    
    if (res.status === 401) {
      throw new Error('❌ Pexels API Key 无效，请检查 .env 中的配置。');
    }

    const data = await res.json();
    if (data.photos && data.photos.length > 0) {
      const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
      return photo.src.large;
    }
  } catch (e) {
    console.error('Pexels API error:', e.message);
    throw e;
  }
  return '';
}


async function processImagePlaceholders(content) {
  const regex = /\[IMAGE_PLACEHOLDER:\s*(.+?)\]/g;
  const matches = [...content.matchAll(regex)];
  let newContent = content;
  
  for (const match of matches) {
    const fullMatch = match[0];
    const query = match[1].trim();
    try {
      const imageUrl = await fetchPexelsImage(query);
      if (imageUrl) {
        newContent = newContent.replace(fullMatch, `![${query}](${imageUrl})`);
      } else {
        newContent = newContent.replace(fullMatch, `*(未找到关于 "${query}" 的图片，请尝试更换关键词)*`);
      }
    } catch (e) {
      newContent = newContent.replace(fullMatch, `*(图片获取失败: ${e.message})*`);
      console.error(e.message);
    }
  }
  return newContent;
}

/**
 * Generate tweets using DeepSeek API
 * Uses native fetch (available in Node 20+) to avoid extra dependencies.
 */
async function generateWithDeepSeek(content, isSociety = false) {
  if (!config.DEEPSEEK_API_KEY || config.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    throw new Error('DEEPSEEK_API_KEY is not defined or is still the placeholder. Please update your .env file.');
  }

  const basePrompt = isSociety ? societyViralPrompt : userTweetPrompt;
  const prompt = `
${basePrompt}

Source content:
"""
${content}
"""

Output Format:
You MUST output a valid JSON object (NOT an array). Do not write any explanations before or after the JSON.
The object must have exactly these keys:
- "content": The complete tweet text. If it's a thread, join all thread parts with a line containing ONLY --- between them. All thread parts go in this ONE field.
- "angle": A brief description of the angle or concept used.
`;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: config.DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert copywriter. You must output only a valid JSON array of objects. Do not wrap in markdown block wrappers or markdown formatting, output raw JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: {
          type: 'json_object'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API returned HTTP ${response.status}: ${errText}`);
    }

    const result = await response.json();
    let text = result.choices[0].message.content.trim();

    // Clean markdown code blocks if the model wrapped it anyway
    if (text.startsWith('```')) {
      text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    let parsed = JSON.parse(text);
    // Normalize to array
    if (Array.isArray(parsed)) {
      parsed = parsed;
    } else if (parsed.tweets && Array.isArray(parsed.tweets)) {
      parsed = parsed.tweets;
    } else {
      parsed = [parsed];
    }
    return parsed;
  } catch (error) {
    console.error('Error generating tweets via DeepSeek API:', error.message);
    throw error;
  }
}

/**
 * Generate tweets using Gemini API
 */
async function generateWithGemini(content, isSociety = false) {
  const ai = getGeminiClient();
  const basePrompt = isSociety ? societyViralPrompt : userTweetPrompt;
  
  const prompt = `
${basePrompt}

Source content:
"""
${content}
"""
`;

  try {
    const response = await ai.models.generateContent({
      model: config.GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            content: { 
              type: 'string', 
              description: 'The exact text content of the tweet/post. If it is a thread, join all thread parts with a line containing ONLY --- between them. All thread parts must go in this one string.' 
            },
            angle: { 
              type: 'string', 
              description: 'A brief description of the angle, hook, or concept used for this tweet.' 
            }
          },
          required: ['content', 'angle']
        }
      }
    });

    let parsed = JSON.parse(response.text);
    if (!Array.isArray(parsed)) {
      parsed = [parsed];
    }
    return parsed;
  } catch (error) {
    console.error('Error generating tweets via Gemini API:', error.message);
    throw error;
  }
}

/**
 * Route content generation to the chosen AI provider
 */
async function generateTweetsFromContent(content, category) {
  const isSociety = !!(category && category.includes('\u793e\u4f1a\u6c11\u751f'));
  if (config.AI_PROVIDER === 'deepseek') {
    return generateWithDeepSeek(content, isSociety);
  } else {
    return generateWithGemini(content, isSociety);
  }
}

/**
 * Generate WeChat Article
 */
async function generateWeChatArticle(topic) {
  const prompt = `
${wechatArticlePrompt}

主题/素材：
"""
${topic}
"""

Output Format:
You MUST output a valid JSON object. Do not write any explanations.
The object must have exactly these keys:
- "title": The article title.
- "content": The article body in Markdown format (including the image links).
`;

  let articleData;
  if (config.AI_PROVIDER === 'deepseek') {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: config.DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: 'You are an expert copywriter. Output JSON only.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });
    const result = await response.json();
    let text = result.choices[0].message.content.trim();
    if (text.startsWith('```')) text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    articleData = JSON.parse(text);
  } else {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: config.GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['title', 'content']
        }
      }
    });
    articleData = JSON.parse(response.text);
  }
  
  articleData.content = await processImagePlaceholders(articleData.content);
  return articleData;
}

/**
 * Generate 10 hot tweets from daily RSS feed content using DeepSeek API
 */
async function generateHotTweetsWithDeepSeek(content) {
  if (!config.DEEPSEEK_API_KEY || config.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    throw new Error('DEEPSEEK_API_KEY is not defined or is still the placeholder. Please update your .env file.');
  }

  const prompt = `
You are a brilliant Twitter/X ghostwriter and tech news curator.
Read the following daily RSS feed items (titles, links, and snippets). 
Select the most interesting, important, or trending topics and write EXACTLY 10 distinct, high-quality, engaging tweets.

Rules for each tweet:
1. Length: No strict length limit, but keep it concise and punchy.
2. Language: Write in Chinese (simplified). Keep the tone natural and authentic.
3. Tone: Direct, engaging, conversational, and informative.
4. Content: Present the news/idea concisely, maybe add a brief insightful comment. You can include a URL if relevant.
5. Formatting (CRITICAL): MUST use "one sentence per line" style. After every single sentence or short thought, you MUST press Enter twice to create a blank empty line. Do NOT write dense blocks of text. Twitter users prefer spacious, high-breathing-room formatting.
6. Output EXACTLY 10 items.

Source content:
"""
${content}
"""

Output Format:
You MUST output a valid JSON array of objects. Do not write any explanations before or after the JSON.
Each object in the array must have exactly the following keys:
- "content": The exact text content of the tweet/post.
- "angle": A brief description of why this piece of news is hot/interesting.
`;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: config.DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert copywriter. You must output only a valid JSON array of objects. Do not wrap in markdown block wrappers or markdown formatting, output raw JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: {
          type: 'json_object'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API returned HTTP ${response.status}: ${errText}`);
    }

    const result = await response.json();
    let text = result.choices[0].message.content.trim();

    if (text.startsWith('\`\`\`')) {
      text = text.replace(/^\`\`\`json\s*/i, '').replace(/\`\`\`$/, '').trim();
    }

    let parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      if (parsed.tweets && Array.isArray(parsed.tweets)) {
        parsed = parsed.tweets;
      } else {
        parsed = [parsed];
      }
    }
    return parsed;
  } catch (error) {
    console.error('Error generating hot tweets via DeepSeek API:', error.message);
    throw error;
  }
}

/**
 * Generate 10 hot tweets from daily RSS feed content using Gemini API
 */
async function generateHotTweetsWithGemini(content) {
  const ai = getGeminiClient();
  
  const prompt = `
You are a brilliant Twitter/X ghostwriter and tech news curator.
Read the following daily RSS feed items (titles, links, and snippets). 
Select the most interesting, important, or trending topics and write EXACTLY 10 distinct, high-quality, engaging tweets.

Rules for each tweet:
1. Length: No strict length limit, but keep it concise and punchy.
2. Language: Write in Chinese (simplified). Keep the tone natural and authentic.
3. Tone: Direct, engaging, conversational, and informative.
4. Content: Present the news/idea concisely, maybe add a brief insightful comment. You can include a URL if relevant.
5. Formatting (CRITICAL): MUST use "one sentence per line" style. After every single sentence or short thought, you MUST press Enter twice to create a blank empty line. Do NOT write dense blocks of text. Twitter users prefer spacious, high-breathing-room formatting.
6. Output EXACTLY 10 items.

Source content:
"""
${content}
"""
`;

  try {
    const response = await ai.models.generateContent({
      model: config.GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { 
                type: 'string', 
                description: 'The exact text content of the tweet/post, formatted for Twitter/X. Under 280 characters.' 
              },
              angle: { 
                type: 'string', 
                description: 'A brief description of why this piece of news is hot/interesting.' 
              }
            },
            required: ['content', 'angle']
          }
        }
      }
    });

    const parsed = JSON.parse(response.text);
    return parsed;
  } catch (error) {
    console.error('Error generating hot tweets via Gemini API:', error.message);
    throw error;
  }
}

/**
 * Route RSS content generation to the chosen AI provider
 */
async function generateHotTweetsFromRSS(content) {
  if (config.AI_PROVIDER === 'deepseek') {
    return generateHotTweetsWithDeepSeek(content);
  } else {
    return generateHotTweetsWithGemini(content);
  }
}

/**
 * Handle natural language conversation
 */
async function chatWithDeepSeek(messages) {
  if (!config.DEEPSEEK_API_KEY || config.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') throw new Error('Missing API key');
  
  const deepseekMessages = [
    { role: 'system', content: chatSystemPrompt },
    ...messages
  ];

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: config.DEEPSEEK_MODEL,
      messages: deepseekMessages,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) throw new Error(`DeepSeek API error: ${await response.text()}`);
  const result = await response.json();
  let text = result.choices[0].message.content.trim();
  if (text.startsWith('```')) text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  
  try {
    return JSON.parse(text);
  } catch (e) {
    // Fallback if AI didn't output JSON
    return { is_tweet: false, reply: text || "对不起，我暂时无法回应。" };
  }
}

async function chatWithGemini(messages) {
  const ai = getGeminiClient();
  
  // Convert standard messages to Gemini format
  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  
  // Insert system prompt as the first user message for Gemini
  contents.unshift({ role: 'user', parts: [{ text: chatSystemPrompt }] });

  const response = await ai.models.generateContent({
    model: config.GEMINI_MODEL,
    contents: contents,
    config: {
      responseMimeType: 'application/json'
    }
  });
  
  let text = response.text || "";
  try {
    return JSON.parse(text);
  } catch (e) {
    return { is_tweet: false, reply: text || "对不起，我暂时无法回应。" };
  }
}

async function chatWithAI(messages) {
  if (config.AI_PROVIDER === 'deepseek') {
    return chatWithDeepSeek(messages);
  } else {
    return chatWithGemini(messages);
  }
}

async function simpleChatWithDeepSeek(messages) {
  if (!config.DEEPSEEK_API_KEY || config.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') throw new Error('Missing API key');
  
  const deepseekMessages = [
    { role: 'system', content: 'You are a highly intelligent and capable AI assistant (acting as a Telegram Bot). Respond in a natural, helpful, and friendly conversational tone.' },
    ...messages
  ];

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: config.DEEPSEEK_MODEL,
      messages: deepseekMessages
    })
  });

  if (!response.ok) throw new Error(`DeepSeek API error: ${await response.text()}`);
  const result = await response.json();
  return result.choices[0].message.content.trim();
}

async function simpleChatWithGemini(messages) {
  const ai = getGeminiClient();
  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  contents.unshift({ role: 'user', parts: [{ text: 'You are a highly intelligent and capable AI assistant (acting as a Telegram Bot). Respond in a natural, helpful, and friendly conversational tone.' }] });

  const response = await ai.models.generateContent({
    model: config.GEMINI_MODEL,
    contents: contents
  });
  
  return response.text;
}

async function simpleChatWithAI(messages) {
  if (config.AI_PROVIDER === 'deepseek') {
    return simpleChatWithDeepSeek(messages);
  } else {
    return simpleChatWithGemini(messages);
  }
}

async function translateToChinese(text) {
  const prompt = `Translate the following list into Chinese (Simplified). Keep the exact original index format (e.g. [1], [2]). Do not add any extra conversational filler, just return the translated text directly.\n\n${text}`;
  
  if (config.AI_PROVIDER === 'deepseek') {
    if (!config.DEEPSEEK_API_KEY || config.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') throw new Error('Missing API key');
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: config.DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const result = await response.json();
    return result.choices[0].message.content.trim();
  } else {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: config.GEMINI_MODEL,
      contents: prompt
    });
    return response.text;
  }
}

module.exports = {
  generateTweetsFromContent,
  generateHotTweetsFromRSS,
  chatWithAI,
  simpleChatWithAI,
  translateToChinese,
  generateWeChatArticle
};
