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
const MODEL = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini";

let openaiClient = null;

/**
 * Initialize the OpenAI client
 * Returns null if API key is not configured
 */
function initializeClient() {
  if (!API_KEY || API_KEY.trim() === "") {
    return null;
  }

  try {
    openaiClient = new OpenAI({
      apiKey: API_KEY,
      dangerouslyAllowBrowser: true, // Required for frontend-only usage
    });
    return openaiClient;
  } catch (error) {
    console.error("Failed to initialize OpenAI client:", error.message);
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
 */
function buildContextData(data) {
  const { user, memories, routine, reminders, games, currentTime } = data;

  // Limit memories to most recent 5 to reduce token usage
  const recentMemories = memories.slice(0, 5).map(m => ({
    title: m.title,
    description: m.description,
    favorite: m.favorite
  }));

  // Limit routine to next 5 items
  const upcomingRoutine = routine.filter(r => !r.completed).slice(0, 5);

  // Limit reminders to pending important ones
  const pendingReminders = reminders.filter(r => r.important && !r.completed).slice(0, 5);

  // Limit games to first 3
  const availableGames = games.slice(0, 3).map(g => ({
    name: g.name,
    href: g.href,
    duration: g.duration,
    skillTarget: g.skillTarget
  }));

  return {
    userName: user?.name || "friend",
    memories: recentMemories,
    routine: upcomingRoutine,
    reminders: pendingReminders,
    games: availableGames,
    currentTime
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
    const limitedHistory = conversationHistory.slice(-10).map(msg => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.text
    }));

    // Build messages array
    const messages = [
      systemMessage,
      ...limitedHistory,
      { role: "user", content: userMessage }
    ];

    // Call OpenAI API
    const response = await openaiClient.responses.create({
      model: MODEL,
      input: messages,
      max_tokens: 500,
      temperature: 0.7
    });

    // Extract response text
    const responseText = response.output_text || response.output?.[0]?.content?.[0]?.text || "";

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
    // Handle specific error types
    if (error.status === 401) {
      return {
        success: false,
        error: "INVALID_KEY",
        text: "Clara's API key is invalid. Please check your VITE_OPENAI_API_KEY."
      };
    }

    if (error.status === 429) {
      return {
        success: false,
        error: "RATE_LIMIT",
        text: "Clara is busy right now. Please wait a moment and try again."
      };
    }

    if (error.status === 500 || error.status === 503) {
      return {
        success: false,
        error: "SERVICE_ERROR",
        text: "Clara is having technical difficulties. Please try again later."
      };
    }

    // Network errors
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return {
        success: false,
        error: "NETWORK_ERROR",
        text: "Could not connect to Clara. Please check your internet connection."
      };
    }

    // Generic error
    console.error("OpenAI API error:", error.message);
    return {
      success: false,
      error: "UNKNOWN_ERROR",
      text: "Something went wrong. Please try again."
    };
  }
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
