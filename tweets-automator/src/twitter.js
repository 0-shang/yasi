const { TwitterApi } = require('twitter-api-v2');
const config = require('./config');

let twitterInstance = null;

function getTwitterClient() {
  const { apiKey, apiSecret, accessToken, accessSecret } = config.TWITTER;
  if (!apiKey || !apiSecret || !accessToken || !accessSecret || 
      apiKey === 'your_twitter_api_key_here' || apiSecret === 'your_twitter_api_secret_here' || 
      accessToken === 'your_twitter_access_token_here' || accessSecret === 'your_twitter_access_secret_here') {
    throw new Error('Twitter API credentials are not set or are still placeholders. Please update your .env file.');
  }

  if (!twitterInstance) {
    twitterInstance = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: accessToken,
      accessSecret: accessSecret
    });
  }
  return twitterInstance;
}

/**
 * Publish a single tweet or a thread of tweets
 * @param {string|string[]} tweets - A single tweet string, or an array of strings for a thread
 * @returns {Promise<{id: string, urls: string[]}>}
 */
async function postTweetOrThread(tweets) {
  const client = getTwitterClient();
  try {
    const tweetArray = Array.isArray(tweets) ? tweets : [tweets];
    
    // Clean and validate lengths
    const cleanTweets = tweetArray
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (cleanTweets.length === 0) {
      throw new Error('Tweet content is empty.');
    }

    let response;
    if (cleanTweets.length === 1) {
      // Post a single tweet
      response = await client.v2.tweet(cleanTweets[0]);
      const tweetId = response.data.id;
      return {
        id: tweetId,
        urls: [`https://x.com/i/web/status/${tweetId}`]
      };
    } else {
      // Post a thread
      response = await client.v2.tweetThread(cleanTweets);
      // response is an array of tweet creation results
      const ids = response.map(r => r.data.id);
      return {
        id: ids[0], // ID of the first tweet in the thread
        urls: ids.map(id => `https://x.com/i/web/status/${id}`)
      };
    }
  } catch (error) {
    console.error('Error posting to Twitter/X:', error);
    throw error;
  }
}

module.exports = {
  postTweetOrThread
};
