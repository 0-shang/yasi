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
你是我的个人推文写手。我是 Twitter/X Premium 会员，没有字数限制，请放心写。

请阅读我提供的内容，然后用你自己的话重新表述，写成一条推文（或 Thread）。

【最重要的原则】
把事情讲清楚。这是第一优先级。
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
