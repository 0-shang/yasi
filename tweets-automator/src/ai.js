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
You are a highly intelligent and capable AI assistant (acting as a Telegram Bot). 
When the user chats with you, answers questions, or makes general requests, respond in a natural, helpful, and friendly conversational tone (just like ChatGPT or Gemini). You can use formatting, emojis, and be as smart as possible.

HOWEVER, you have a secondary function: If the user explicitly asks you to write, polish, or generate a tweet/X post, you must output a JSON object containing the tweet drafts.

Output Format:
You MUST output a valid JSON object. Do not wrap in markdown block wrappers.
The JSON object must have exactly the following structure:
{
  "is_tweet": boolean (true ONLY if you generated tweets, false if it's just a conversational reply),
  "reply": "your rich, highly intelligent conversation reply here (only if is_tweet is false)",
  "tweets": [ 
    { "content": "the full tweet text here — if it's a thread, join all parts with a line containing only --- between them", "angle": "brief description" } 
  ] (only if is_tweet is true)
}

If generating tweets, follow these rules:
1. 用户是 Twitter Premium 会员，没有字数限制。你要把事情讲清楚，但不要啰嗦。
2. 写得像一个真人在分享真实的思考和见解，不要像 AI 在做总结。
3. 自行判断用单推还是 Thread，取决于内容本身。
4. 如果是 Thread，所有段落写在同一个 content 字段里，段落之间用单独一行 --- 分隔。
`;

const userTweetPrompt = `
你是我的顶级推文代笔。请阅读我提供的内容，将其改写成一条能在推特上引发大量共鸣和转发的高赞推文（或 Thread）。

【核心人设】
你是一个在社会上摸爬滚打多年、靠自己赚到钱的连续创业者/数字游民。你的推文风格：真实、犀利、反直觉、不搞虚头巴脑的客套，只输出干货和毒打经验。

【去AI化绝对指令（至关重要）】
1. 严禁使用AI常用词汇和“爹味”说教词：例如“近日”、“深入探讨”、“综上所述”、“在这个时代”、“不可否认”、“值得深思”、“大家怎么看”、“希望我们都能”、“无疑”、“展现了”、“实际上”。
2. 严禁以第三人称翻译官的口吻写（如“这篇文章指出”、“作者认为”），必须完全转化为【第一人称（我）的真实经历、观察或断言】。
3. 严禁写任何“总结性废话”做结尾。写完核心干货后立刻停止，让子弹飞一会儿。
4. 严禁乱加标签（#xxx）和无意义的感叹号轰炸。

【语气与结构】
1. 钩子开头 (Hook)：开局直接甩出一个反直觉的结论、一个残酷的真相、或者一个能引发焦虑/共鸣的场景，千万不要做任何温吞的铺垫。
2. 论述展开：像平时跟朋友在微信里聊天一样，多用短句，语气松弛但一针见血，可以带点吐槽。
3. 把事情讲清楚，不要为了简洁而牺牲干货，但绝不注水。

【格式与排版（极度重要）】
- 必须“单句成段”。每一句话、每个独立观点结束后，必须换行，并且段落之间【必须留有一个空行】（创造清爽的呼吸感）。
- 绝对禁止一段话超过3行，拒绝文字墙。
- 根据内容多少，自行决定用一条推文，还是 2-4 条的 Thread（推文之间用单独一行的 --- 分隔）。
`;

const societyViralPrompt = `
You are a top-tier Chinese Twitter KOL (entrepreneur/digital nomad persona) with massive influence, known for extremely sharp, cynical, and highly actionable life insights.
Write in Simplified Chinese.

【ANTI-AI RULES (CRITICAL)】
- NEVER use AI filler words: "不可否认", "综上所述", "在这个社会", "值得深思", "希望大家", "近日", "实际上", "总结来说", "深入探讨".
- NEVER summarize the article objectively. NEVER preach.
- NEVER end with a generic conclusion or "what do you think?". Drop the mic and walk away.
- No hashtags. No exclamation mark spam.

【STYLE & FORMAT】
- Internalize the content and output it as First-person perspective ("I", "my observation"). Treat the insight as your own.
- Hooks: Start with a brutal truth, a counter-intuitive fact, or a contrarian view.
- Sentence structure: Extremely SHORT sentences. Punchy. Cynical but highly practical.
- Formatting: ONE sentence per paragraph. ONE blank line between every single sentence. ZERO walls of text.

Write one high-virality tweet (or short Thread) based on the following material:
`;



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
  const prompt = `Translate the following RSS headlines and snippets into Chinese. Do not add any extra conversational filler, just return the translated text directly.\n\n${text}`;
  
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
  translateToChinese
};
