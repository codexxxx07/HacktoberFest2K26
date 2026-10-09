/**
 * AI Service for Clara - Pixel Players Memory Companion
 *
 * SECURITY NOTICE:
 * This is a frontend-only implementation using Vite environment variables.
 *
 * ⚠️ IMPORTANT:
 * - VITE_ prefixed variables are exposed to the browser and are NOT secret
 * - This approach is suitable for local development and personal use only
 * - For production, implement a backend proxy to protect the API key
 *
 * NEVER:
 * - Hardcode a real API key in source code
 * - Commit a real API key to Git
 * - Print the API key in console logs
 * - Include the API key in error messages
 */

import OpenAI from 'openai';

const MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini';
const MAX_TOKENS = 500;

/**
 * Check if OpenAI API key is configured
 */
export function isConfigured() {
  return !!import.meta.env.VITE_OPENAI_API_KEY;
}

/**
 * Clara's system instructions
 * Defines her personality, purpose, and behavior
 */
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
 * Build conversation context from app data
 * Limits the amount of data sent to the API
 * Tolerates missing/undefined collections so a partial app state can never crash the request
 */
function buildContextData(data = {}) {
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const { user, currentTime } = data;
  const memories = asArray(data.memories);
  const routine = asArray(data.routine);
  const reminders = asArray(data.reminders);
  const games = asArray(data.games);

  // Limit memories to most recent 5 to reduce token usage
  const recentMemories = memories.slice(0, 5).map((m) => ({
    title: m?.title,
    description: m?.description,
    favorite: !!m?.favorite,
  }));

  // Limit routine to next 5 items
  const upcomingRoutine = routine.filter((r) => r && !r.completed).slice(0, 5);

  // Limit reminders to pending important ones
  const pendingReminders = reminders.filter((r) => r && r.important && !r.completed).slice(0, 5);

  // Limit games to first 3
  const availableGames = games.slice(0, 3).map((g) => ({
    name: g?.name,
    href: g?.href,
    duration: g?.duration,
    skillTarget: g?.skillTarget,
  }));

  let formattedTime;
  try {
    const date = currentTime ? new Date(currentTime) : new Date();
    formattedTime = Number.isNaN(date.getTime()) ? new Date().toLocaleString() : date.toLocaleString();
  } catch {
    formattedTime = new Date().toLocaleString();
  }

  return {
    userName: user?.name || "friend",
    memories: recentMemories,
    routine: upcomingRoutine,
    reminders: pendingReminders,
    games: availableGames,
    currentTime: formattedTime,
  };
}

/**
 * Send a message to OpenAI API and get a response
 *
 * @param {string} userMessage - The user's message
 * @param {object} appData - Application context data
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Promise<object>} - Response with text and metadata
 */
export async function getAIResponse(userMessage, appData, conversationHistory = []) {
  // Check if API key is configured
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "API_KEY_MISSING",
      text: "Clara needs an OpenAI API key to work. Please add VITE_OPENAI_API_KEY to your .env.local file."
    };
  }

  // Validate input
  if (!userMessage || userMessage.trim() === "") {
    return {
      success: false,
      error: "EMPTY_MESSAGE",
      text: "Please enter a message for Clara."
    };
  }

  try {
    // Build context data with limits
    const contextData = buildContextData(appData);

    // Build system message with context
    const systemMessage = {
      role: "system",
      content: `${CLARA_SYSTEM_INSTRUCTIONS}\n\nCurrent context:\nUser name: ${contextData.userName}\nCurrent time: ${contextData.currentTime}\nMemories saved: ${contextData.memories.length}\nUpcoming routine items: ${contextData.routine.length}\nPending reminders: ${contextData.reminders.length}\nAvailable games: ${contextData.games.map(g => g.name).join(", ")}`
    };

    // Build conversation history (limit to last 10 messages)
    // Skips greeting/setup/system notes so only real user/Clara turns are replayed
    const sourceHistory = Array.isArray(conversationHistory) ? conversationHistory : [];
    const limitedHistory = sourceHistory
      .filter((msg) => msg && typeof msg.text === "string" && msg.text.trim() !== "" && msg.context !== "setup")
      .slice(-10)
      .map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.text,
      }));

    // Build messages array
    const messages = [
      systemMessage,
      ...limitedHistory,
      { role: "user", content: userMessage }
    ];

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Required for frontend-only implementation
    });

    console.log("[Clara Debug] Calling OpenAI API with model:", MODEL);

    // Call OpenAI API using the correct chat completions endpoint
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: messages,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
    });

    console.log("[Clara Debug] OpenAI response received");

    // Extract response text from the correct response structure
    const replyText = response?.choices?.[0]?.message?.content?.trim() || '';

    if (!replyText) {
      return {
        success: false,
        error: "EMPTY_RESPONSE",
        text: "Clara didn't provide a response. Please try again."
      };
    }

    return {
      success: true,
      text: replyText
    };

  } catch (error) {
    console.error("[Clara Debug] OpenAI API exception:", error.name, error.message);
    return describeApiError(error);
  }
}

/**
 * Map an OpenAI SDK error to a structured, user-friendly result.
 * Never includes the API key or raw request details in the message.
 */
function describeApiError(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  const errorName = error?.name;
  const status = error?.status;
  const errorCode = error?.code;
  const errorType = error?.type;

  // Log detailed diagnostic information (safe: no API key or secrets)
  console.error("[Clara API Error Diagnostics]", {
    errorName,
    message: message || "No message",
    isConfigured: isConfigured(),
    errorConstructor: error?.constructor?.name,
    httpStatus: status,
    apiErrorCode: errorCode,
    apiErrorType: errorType,
    stack: error?.stack?.split('\n')?.slice(0, 3) // Only first 3 stack frames
  });

  // Handle specific OpenAI error types
  if (status === 401 || status === 403) {
    return {
      success: false,
      error: "INVALID_KEY",
      text: "Clara's API key is invalid or has been revoked. Please check your VITE_OPENAI_API_KEY in .env.local"
    };
  }

  if (status === 404) {
    return {
      success: false,
      error: "MODEL_NOT_FOUND",
      text: `The AI model '${MODEL}' is not available. Please check your OpenAI account access or set VITE_OPENAI_MODEL in .env.local`
    };
  }

  if (status === 429) {
    if (errorCode === "insufficient_quota" || message?.includes("quota")) {
      return {
        success: false,
        error: "OUT_OF_CREDITS",
        text: "Clara's OpenAI account has no remaining credits. Please add credits to your OpenAI account."
      };
    }
    return {
      success: false,
      error: "RATE_LIMIT",
      text: "Clara is receiving too many requests. Please wait a moment and try again."
    };
  }

  if (status === 400 || status === 422) {
    return {
      success: false,
      error: "INVALID_REQUEST",
      text: `Clara couldn't process that request: ${message || "Invalid request"}`
    };
  }

  if (status && status >= 500) {
    return {
      success: false,
      error: "SERVICE_ERROR",
      text: "OpenAI's service is temporarily unavailable. Please try again later."
    };
  }

  // Handle network/connection errors
  if (errorName === "APIConnectionError" || error?.constructor?.name === "APIConnectionError" || (errorName === "TypeError" && /fetch|network|load failed/i.test(message))) {
    return {
      success: false,
      error: "NETWORK_ERROR",
      text: "Could not connect to OpenAI. Please check your internet connection and try again."
    };
  }

  // Generic error - preserve the actual error message
  console.error("API error:", message || error);
  return {
    success: false,
    error: "UNKNOWN_ERROR",
    text: message || "Something went wrong. Please try again.",
  };
}

/**
 * Get a friendly setup message when API is not configured
 */
export function getSetupMessage() {
  return `Clara is ready to help, but needs an OpenAI API key to work.

To enable Clara:
1. Get an API key from https://platform.openai.com/api-keys
2. Create a .env.local file in the project root
3. Add: VITE_OPENAI_API_KEY=your_actual_api_key_here
4. Restart the development server (npm run dev)

Note: This is a frontend-only implementation suitable for local development.
For production, implement a backend proxy to protect the API key.`;
}
