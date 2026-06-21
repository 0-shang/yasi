const { GoogleGenAI } = require('@google/genai');
const config = require('./config');

let aiInstance = null;

function getAIClient() {
  if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not defined or is still the placeholder. Please update your .env file.');
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  }
  return aiInstance;
}

/**
 * Generate tweet drafts from markdown content
 * @param {string} content - Markdown content of the source note
 * @returns {Promise<Array<{content: string, angle: string}>>}
 */
async function generateTweetsFromContent(content) {
  const ai = getAIClient();
  
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

module.exports = {
  generateTweetsFromContent
};
