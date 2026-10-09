import OpenAI from "openai";

/**
 * AI Service for Clara - Pixel Players Memory Companion
 * 
 * SECURITY NOTICE:
 * This is a FRONTEND-ONLY implementation using Vite environment variables.
 * VITE_ prefixed variables are exposed to the browser and are NOT secret.
 * 
 * If deployed publicly, the API key can be extracted by users.
 * This approach is suitable for local development and personal use only.
 * For production, use a backend proxy to protect the API key.
 * 
 * NEVER:
 * - Hardcode a real API key in source code
 * - Commit a real API key to Git
 * - Print the API key in console logs
 * - Include the API key in error messages
 */

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
// gpt-4o-mini is available on the Responses API and matches the documented default.
const MODEL = (import.meta.env.VITE_OPENAI_MODEL || "").trim() || "gpt-4o-mini";

let openaiClient = null;

/**
 * Initialize the OpenAI client
 * Returns null if API key is not configured
 */
function initializeClient() {
  if (!API_KEY || API_KEY.trim() === "") {
    console.error("[Clara] API key missing or empty");
    return null;
  }

  try {
    console.log("[Clara] Initializing OpenAI client with key present");
    openaiClient = new OpenAI({
      apiKey: API_KEY,
      dangerouslyAllowBrowser: true, // Required for frontend-only usage
    });
    console.log("[Clara] OpenAI client initialized successfully");
    return openaiClient;
  } catch (error) {
    console.error("[Clara] Failed to initialize OpenAI client:", error.message);
    return null;
  }
}

/**
 * Check if OpenAI is properly configured
 */
export function isConfigured() {
  return !!(API_KEY && API_KEY.trim() !== "");
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
 * Send a message to OpenAI and get a response
 * 
 * @param {string} userMessage - The user's message
 * @param {object} appData - Application context data
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Promise<object>} - Response with text and metadata
 */
export async function getAIResponse(userMessage, appData, conversationHistory = []) {
  // Check if API is configured
  if (!isConfigured()) {
    return {
      success: false,
      error: "API_KEY_MISSING",
      text: "Clara needs an API key to work. Please add VITE_OPENAI_API_KEY to your environment variables."
    };
  }

  // Initialize client if not already done
  if (!openaiClient) {
    openaiClient = initializeClient();
    if (!openaiClient) {
      return {
        success: false,
        error: "INIT_FAILED",
        text: "Could not initialize Clara. Please check your API key configuration."
      };
    }
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

    // Call OpenAI API (Responses API) with timeout to prevent indefinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response;
    try {
      response = await openaiClient.responses.create({
        model: MODEL,
        input: messages,
        max_output_tokens: 500,
        temperature: 0.7,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Extract response text (output_text is the SDK shortcut, fallback walks the output array)
    const fallbackText = (Array.isArray(response?.output) ? response.output : [])
      .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("");
    const responseText = (response?.output_text || fallbackText).trim();

    if (!responseText) {
      return {
        success: false,
        error: "EMPTY_RESPONSE",
        text: "Clara didn't provide a response. Please try again."
      };
    }

    return {
      success: true,
      text: responseText
    };

  } catch (error) {
    return describeApiError(error);
  }
}

/**
 * Map an OpenAI SDK error to a structured, user-friendly result.
 * Never includes the API key or raw request details in the message.
 */
function describeApiError(error) {
  const status = typeof error?.status === "number" ? error.status : undefined;
  const code = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message : "";
  const errorType = error?.type;
  const requestId = error?.request_id;

  // Log detailed diagnostic information (safe: no API key or secrets)
  console.error("[Clara OpenAI Error Diagnostics]", {
    status,
    code,
    errorType,
    requestId,
    message: message || "No message",
    modelName: MODEL,
    isConfigured: isConfigured(),
    errorName: error?.name,
    errorConstructor: error?.constructor?.name
  });

  if (status === 401 || status === 403) {
    return {
      success: false,
      error: "INVALID_KEY",
      text: "Clara's API key is invalid or was revoked. Please check your VITE_OPENAI_API_KEY.",
    };
  }

  if (status === 404) {
    return {
      success: false,
      error: "MODEL_NOT_FOUND",
      text: `The model "${MODEL}" is not available for this OpenAI account. Check VITE_OPENAI_MODEL or remove it to use the default.`,
    };
  }

  if (status === 429) {
    if (code === "insufficient_quota" || /insufficient quota|exceeded your current quota/i.test(message)) {
      return {
        success: false,
        error: "OUT_OF_CREDITS",
        text: "Your OpenAI account is out of credit. Please add credit to your OpenAI account and try again.",
      };
    }
    return {
      success: false,
      error: "RATE_LIMIT",
      text: "Clara is busy right now. Please wait a moment and try again.",
    };
  }

  if (status === 400 || status === 422) {
    // Log more details for 400/422 since this is the error we're seeing
    console.error("[Clara Invalid Request Details]", {
      errorType,
      code,
      message,
      requestBody: error?.body,
      param: error?.param
    });
    return {
      success: false,
      error: "INVALID_REQUEST",
      text: `Clara couldn't send that request. (Error: ${code || message || 'Invalid request'})`,
    };
  }

  if (status !== undefined && status >= 500) {
    return {
      success: false,
      error: "SERVICE_ERROR",
      text: "Clara is having technical difficulties. Please try again later.",
    };
  }

  // Could not reach the API at all (offline, DNS, CORS, timeout, aborted request).
  // The SDK reports these as APIConnectionError, which keeps status undefined.
  const isConnectionError =
    (typeof OpenAI.APIConnectionError === "function" && error instanceof OpenAI.APIConnectionError) ||
    (typeof OpenAI.APIUserAbortError === "function" && error instanceof OpenAI.APIUserAbortError) ||
    error?.name === "AbortError" ||
    code === "connection_error" ||
    (error?.name === "TypeError" && /fetch|network|load failed/i.test(message)) ||
    /connection error/i.test(message);

  if (isConnectionError) {
    return {
      success: false,
      error: "NETWORK_ERROR",
      text: "Could not connect to Clara. Please check your internet connection.",
    };
  }

  // Generic error
  console.error("OpenAI API error:", message || error);
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
  return `Clara is ready to help, but needs an OpenAI API key to work.

To set up Clara:
1. Get an API key from https://platform.openai.com/api-keys
2. Add it to your .env.local file: VITE_OPENAI_API_KEY=your_key_here
3. Restart the development server

Note: This is a frontend-only implementation. Your API key will be exposed in the browser. For production use, implement a backend proxy.`;
}
