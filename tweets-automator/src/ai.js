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
    { "content": "tweet text here", "angle": "brief description of the angle" } 
  ] (only if is_tweet is true)
}

If generating tweets, follow these rules:
1. 【黄金第一句 (Hook)】：极具吸引力。
2. 【极简排版】：每句话独立成行，段落之间留空行。
3. 【精简人话】：大白话，自信真诚，不要AI味，禁感叹号和无意义标签。
4. 【字数限制】：单条推文 130 中文以内。
5. 【Thread格式】：如内容多，生成 2-4 条的 Thread，推文之间用单独的 \`---\` 分隔。
`;

const userTweetPrompt = `
你是一个顶级的 X (Twitter) 个人 IP 运营专家与文案大师，擅长将长篇干货笔记提炼成高互动率、高传播性的推文。

请阅读我提供的这篇笔记/收藏文章，提取出其中最核心的【黄金认知】、【颠覆性观点】或【实操指南】，将其重写为一条 Twitter 单推，或一个逻辑严密的 Twitter Thread (系列推文)。

请遵循以下【文案准则】：
1. 【黄金第一句 (Hook)】：第一句必须极具吸引力，能够让读者在信息流中停下刷屏。可以使用：反直觉观点、冲突对比、痛点揭示或直接给出的巨大收益。
2. 【极简排版】：每句话独立成行，段落之间留空行。每行不要太长。多用列表呈现步骤。
3. 【精简人话】：使用大白话，语气要自信、真诚、平视读者，不要带那种AI的味道。绝对不要使用任何死板的翻译腔，禁止使用过度夸张的感叹号，禁止使用无意义的标签（如 #AI #学习）。
4. 【字数限制】：每个推文区块的字数必须控制在 130 个中文字符以内（防止超出 Twitter 限制）。
5. 【系统兼容格式】：如果内容较多，请生成 2-4 条组成的 Thread，并在两条推文之间用单独一行的 \`---\` 分隔。不要自己加上任何 \`status: draft\` 等头部信息，直接输出内容即可。
`;


/**
 * Generate tweets using DeepSeek API
 * Uses native fetch (available in Node 20+) to avoid extra dependencies.
 */
async function generateWithDeepSeek(content) {
  if (!config.DEEPSEEK_API_KEY || config.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    throw new Error('DEEPSEEK_API_KEY is not defined or is still the placeholder. Please update your .env file.');
  }

  const prompt = `
${userTweetPrompt}

Source content:
"""
${content}
"""

Output Format:
You MUST output a valid JSON array of objects. Do not write any explanations before or after the JSON.
Each object in the array must have exactly the following keys:
- "content": The exact text content of the tweet/post.
- "angle": A brief description of the angle, hook, or concept used for this tweet.
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
    if (!Array.isArray(parsed)) {
      if (parsed.tweets && Array.isArray(parsed.tweets)) {
        parsed = parsed.tweets;
      } else {
        parsed = [parsed];
      }
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
async function generateWithGemini(content) {
  const ai = getGeminiClient();
  
  const prompt = `
${userTweetPrompt}

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
                description: 'A brief description of the angle, hook, or concept used for this tweet.' 
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
    console.error('Error generating tweets via Gemini API:', error.message);
    throw error;
  }
}

/**
 * Route content generation to the chosen AI provider
 */
async function generateTweetsFromContent(content) {
  if (config.AI_PROVIDER === 'deepseek') {
    return generateWithDeepSeek(content);
  } else {
    return generateWithGemini(content);
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
1. Length: Must be under 280 characters.
2. Language: Write in Chinese (simplified). Keep the tone natural and authentic.
3. Tone: Direct, engaging, conversational, and informative.
4. Content: Present the news/idea concisely, maybe add a brief insightful comment. You can include a URL if relevant (will count towards length).
5. Output EXACTLY 10 items.

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
1. Length: Must be under 280 characters.
2. Language: Write in Chinese (simplified). Keep the tone natural and authentic.
3. Tone: Direct, engaging, conversational, and informative.
4. Content: Present the news/idea concisely, maybe add a brief insightful comment. You can include a URL if relevant (will count towards length).
5. Output EXACTLY 10 items.

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
  translateToChinese
};
