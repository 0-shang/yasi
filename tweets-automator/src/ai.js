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

/**
 * Generate tweets using DeepSeek API
 * Uses native fetch (available in Node 20+) to avoid extra dependencies.
 */
async function generateWithDeepSeek(content) {
  if (!config.DEEPSEEK_API_KEY || config.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    throw new Error('DEEPSEEK_API_KEY is not defined or is still the placeholder. Please update your .env file.');
  }

  const prompt = `
You are a brilliant Twitter/X ghostwriter and content creator.
Read the following article, notes, or web clipping. Identify the most valuable, interesting, or thought-provoking ideas and write 1 to 3 distinct, high-quality, engaging tweets.

Rules for each tweet:
1. Length: Must be under 280 characters.
2. Language: Write in Chinese (simplified) unless the source is in English and it makes sense to output in English. Keep the tone natural and authentic.
3. Tone: Direct, engaging, conversational, and personal (as if written by an individual sharing their real learning journey or sharp insights).
4. Formatting: Avoid generic hashtags (e.g., #productivity). Only use highly specific ones if absolutely necessary. Avoid spammy emojis. Use line breaks to make it highly readable.
5. Content: It can be a punchy quote, a contrarian perspective, a list of actionable takeaways, or a concise explanation of a concept.

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
You are a brilliant Twitter/X ghostwriter and content creator.
Read the following article, notes, or web clipping. Identify the most valuable, interesting, or thought-provoking ideas and write 1 to 3 distinct, high-quality, engaging tweets.

Rules for each tweet:
1. Length: Must be under 280 characters.
2. Language: Write in Chinese (simplified) unless the source is in English and it makes sense to output in English. Keep the tone natural and authentic.
3. Tone: Direct, engaging, conversational, and personal (as if written by an individual sharing their real learning journey or sharp insights).
4. Formatting: Avoid generic hashtags (e.g., #productivity). Only use highly specific ones if absolutely necessary. Avoid spammy emojis. Use line breaks to make it highly readable.
5. Content: It can be a punchy quote, a contrarian perspective, a list of actionable takeaways, or a concise explanation of a concept.

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

module.exports = {
  generateTweetsFromContent,
  generateHotTweetsFromRSS
};
