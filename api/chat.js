import OpenAI from 'openai';

// Configuration constants
const MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 500;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REQUESTS_PER_MINUTE = 20;

// Simple in-memory rate limiting (for production, use Redis or a proper rate limiter)
const rateLimitMap = new Map();

function getRateLimitKey(ip) {
  return ip || 'unknown';
}

function checkRateLimit(ip) {
  const key = getRateLimitKey(ip);
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  // Clean up old entries
  const entries = rateLimitMap.get(key) || [];
  const recentEntries = entries.filter(timestamp => timestamp > windowStart);

  if (recentEntries.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  recentEntries.push(now);
  rateLimitMap.set(key, recentEntries);
  return true;
}

// Clara's system instructions
const CLARA_SYSTEM_INSTRUCTIONS = `You are Clara, a friendly memory companion for Pixel Players. Your primary purpose is to support elderly users, including people living with dementia, with everyday guidance and cognitive activities.

Your personality:
- Warm, patient, calm, respectful, and encouraging
- Clear and easy to understand
- Never childish or patronizing
- Prefer short, easy-to-follow sentences

You help users with:
- Understanding Pixel Players features
- Finding appropriate cognitive games
- Explaining game instructions
- Organizing daily routines
- Discussing personal memories that the user has actually shared
- Explaining reminder workflows
- Providing gentle everyday guidance
- Supporting Hindi, Bengali, and English conversations

IMPORTANT CONSTRAINTS:
1. Respond in the language used by the user whenever practical.
2. Do NOT invent the user's personal memories, family members, routine, reminders, medical information, or location.
3. Do NOT claim to have saved a memory or reminder unless the application has actually performed that operation.
4. You are NOT a diagnostic or medical-treatment system. Do NOT claim to diagnose or cure dementia, assess dementia severity, or independently make medication decisions.
5. Send only the context required to answer the user's current question. Do not send unnecessary personal data to the API.

When the user asks about:
- Games: Suggest available games from the provided context
- Memories: Reference only memories that exist in the provided context
- Routine: Use only the routine data provided in context
- Reminders: Use only the reminder data provided in context

If you don't have information about something the user asks, say so honestly and suggest they check the relevant section of the app.`;

/**
 * Vercel serverless function for OpenAI chat completions
 * POST /api/chat
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get client IP for rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || 'unknown';

  // Check rate limit
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  // Validate request body
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }

  // Cap number of messages
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: `Too many messages. Maximum ${MAX_MESSAGES} allowed.` });
  }

  // Validate each message
  for (const msg of messages) {
    if (!msg.content || typeof msg.content !== 'string') {
      return res.status(400).json({ error: 'Invalid message: content required' });
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` });
    }
  }

  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: API key missing' });
  }

  try {
    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Build messages array with system prompt
    const apiMessages = [
      { role: 'system', content: CLARA_SYSTEM_INSTRUCTIONS },
      ...messages
    ];

    // Call OpenAI API
    const response = await openai.responses.create({
      model: MODEL,
      input: apiMessages,
      max_output_tokens: MAX_TOKENS,
      temperature: 0.7,
    });

    // Extract response text
    const fallbackText = (Array.isArray(response?.output) ? response.output : [])
      .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('');
    const replyText = (response?.output_text || fallbackText).trim();

    if (!replyText) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    // Return success response
    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error('OpenAI API error:', error.message);

    // Handle specific error types
    if (error.status === 401 || error.status === 403) {
      return res.status(500).json({ error: 'Invalid API key configuration' });
    }

    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    if (error.status === 404) {
      return res.status(500).json({ error: 'Model not available' });
    }

    if (error.status >= 500) {
      return res.status(503).json({ error: 'OpenAI service unavailable. Please try again later.' });
    }

    // Generic error
    return res.status(500).json({ error: 'Failed to process request' });
  }
}
