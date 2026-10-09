/**
 * AI Service for Clara - Pixel Players Memory Companion
 *
 * SECURITY NOTICE:
 * This implementation uses a backend proxy (/api/chat) to protect the API key.
 * The API key is stored server-side and never exposed to the browser.
 *
 * NEVER:
 * - Hardcode a real API key in source code
 * - Commit a real API key to Git
 * - Print the API key in console logs
 * - Include the API key in error messages
 */

const API_ENDPOINT = '/api/chat';

/**
 * Check if the backend API is available
 * For this implementation, we assume the backend is always available
 */
export function isConfigured() {
  return true;
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
 * Send a message to the backend API and get a response
 *
 * @param {string} userMessage - The user's message
 * @param {object} appData - Application context data
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Promise<object>} - Response with text and metadata
 */
export async function getAIResponse(userMessage, appData, conversationHistory = []) {
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

    // Call backend API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response;
    try {
      response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        error: "API_ERROR",
        text: errorData.error || `Clara encountered an error (${response.status}). Please try again.`
      };
    }

    const data = await response.json();
    const replyText = data.reply?.trim();

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
    return describeApiError(error);
  }
}

/**
 * Map a fetch error to a structured, user-friendly result.
 * Never includes the API key or raw request details in the message.
 */
function describeApiError(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  const errorName = error?.name;

  // Log detailed diagnostic information (safe: no API key or secrets)
  console.error("[Clara API Error Diagnostics]", {
    errorName,
    message: message || "No message",
    isConfigured: isConfigured(),
    errorConstructor: error?.constructor?.name
  });

  // Handle abort errors (timeout)
  if (errorName === "AbortError") {
    return {
      success: false,
      error: "TIMEOUT",
      text: "Clara took too long to respond. Please try again.",
    };
  }

  // Handle network errors
  if (errorName === "TypeError" && /fetch|network|load failed/i.test(message)) {
    return {
      success: false,
      error: "NETWORK_ERROR",
      text: "Could not connect to Clara. Please check your internet connection.",
    };
  }

  // Generic error
  console.error("API error:", message || error);
  return {
    success: false,
    error: "UNKNOWN_ERROR",
    text: "Something went wrong. Please try again.",
  };
}

/**
 * Get a friendly setup message when API is not configured
 */
export function getSetupMessage() {
  return `Clara is ready to help, but needs the backend API to be configured.

The backend API endpoint (/api/chat) should be available.
For local development, ensure your development server is running.
For production, ensure OPENAI_API_KEY is set in your Vercel environment variables.`;
}
