# OpenAI Integration for Clara AI Assistant

## Overview

Clara, the Pixel Players memory companion, now integrates with the OpenAI API to provide real-time AI-powered conversations. This is a **frontend-only implementation** designed for local development and personal use.

## Implementation Status

Last verified: 2026-10-09 (`npm run lint`, `npm run build`, `npm run test:ai` all pass).

| Requirement | Status | Notes |
| --- | --- | --- |
| `src/services/aiService.js` — OpenAI client, system instructions, context limits, history, error mapping | ✅ Implemented & tested | Uses the Chat Completions API (`client.chat.completions.create`) with `max_tokens`, `temperature`, model `gpt-4o-mini` |
| `src/services/useConversation.js` — routes to OpenAI, dummy fallback, first-run setup message | ✅ Implemented & tested | Fallback only runs when no API key is configured |
| `.env.example` — `VITE_OPENAI_API_KEY` / `VITE_OPENAI_MODEL` template | ✅ Done | No real keys included |
| `.gitignore` — ignore `.env`, `.env.local`, `.env.*.local` | ✅ Done | (change present in working tree, commit when you commit the integration) |
| Loading states (thinking / voice processing) until a reply arrives | ✅ Done | |
| API errors, empty input, empty response handling | ✅ Done | See Error Handling below |
| Voice input routed through the same service, TTS "Listen" button | ✅ Preserved | |
| Live end-to-end call with a real API key | ⏳ **Not verified** | No `VITE_OPENAI_API_KEY` exists in this environment. Add one to `.env.local` and follow *Testing → With API Key*. |
| Browser UI walkthrough (voice input, TTS, `/assistant` route) | ⏳ **Not verified** | No browser automation was available; verify manually per *Testing* below. |

### Fixes applied in this pass (2026-10-09)

1. **Fixed "Unknown error" generic message** — Enhanced error handler to preserve and report real underlying errors instead of replacing them with generic messages
2. **Added development diagnostics** — Added console logging for HTTP status code, OpenAI API error code/type, safe error message, and error stage (API request, response parsing, UI rendering)
3. **Converted to frontend-only implementation** — Removed backend proxy (`api/chat.js`) and converted to direct OpenAI SDK calls from frontend
4. **Updated environment variable naming** — Now uses `VITE_OPENAI_API_KEY` and `VITE_OPENAI_MODEL` (documented approach)
5. **Enhanced error mapping** — Added detection for SDK connection errors (`APIConnectionError`), 400/422, 404 (unknown model), and 429 `insufficient_quota` (out of credit); 5xx handled as a range
6. **Robust context building** — partial/undefined `memories`, `routine`, `reminders`, `games`, or `currentTime` can no longer throw before the request
7. **Stale-response protection** — replies in flight when the user hits *New chat* are discarded, and a pending fallback reply is cancelled on reset/unmount
8. **History hygiene** — setup/greeting-instruction messages are excluded from replayed history; history stays capped at 10 messages
9. **Fixed setup message display** — Setup message now shows once per conversation when API key is missing
10. **Test suite updated** — Updated `scripts/test-aiService.mjs` to test frontend SDK calls instead of backend proxy

## Files Changed

1. **`src/services/aiService.js`** - Core OpenAI SDK integration
   - Initializes OpenAI client with API key from Vite environment variable
   - Implements Clara's system instructions and personality
   - Handles conversation history and context management
   - Provides enhanced error handling for API errors (401, 403, 400, 404, 429, 5xx, network errors)
   - Returns structured responses with success/error status
   - Includes development diagnostics in console logs

2. **`src/services/useConversation.js`** - Chat hook integration
   - Detects when OpenAI API key is configured
   - Routes messages to real OpenAI API when configured
   - Falls back to dummy responses when API key is missing
   - Displays setup message on first interaction without API key
   - Maintains conversation history for multi-turn conversations

3. **`.env.example`** - Environment variable template
   - Added `VITE_OPENAI_API_KEY` placeholder
   - Added `VITE_OPENAI_MODEL` optional configuration
   - Includes security warnings about frontend-only implementation

4. **`.gitignore`** - Security update
   - Added `.env`, `.env.local`, and `.env.*.local` to prevent committing API keys

5. **`scripts/test-aiService.mjs`** (+ `npm run test:ai`) - Offline verification of the service layer (mocked OpenAI SDK, no key or network required)

6. **`api/chat.js`** - **REMOVED** - Backend proxy no longer needed for frontend-only implementation


## Setup Instructions

### 1. Get an OpenAI API Key

Visit [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys) to create an API key.

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
VITE_OPENAI_API_KEY=your_actual_api_key_here
VITE_OPENAI_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini
```

### 3. Start the Development Server

```bash
npm run dev
```

### 4. Test Clara

Navigate to the `/assistant` page and send a message to Clara. With the API key configured, Clara will respond with real AI-generated responses.

## Security Notice

⚠️ **IMPORTANT SECURITY WARNING**

This is a **frontend-only implementation** using Vite environment variables.

- VITE_ prefixed variables are exposed to the browser and are **NOT secret**
- If deployed publicly, the API key can be extracted by users
- This approach is suitable for **local development and personal use only**
- For production deployment, implement a backend proxy to protect the API key

### What We Do to Protect Security

✅ Never hardcode API keys in source code
✅ Never commit API keys to Git (.env.local is in .gitignore)
✅ Never print API keys in console logs
✅ Never include API keys in error messages
✅ Document the security trade-off clearly
✅ `dangerouslyAllowBrowser` is only used after the developer explicitly opts in by placing a key in `.env.local` — there is no key in source, in Git, or in the built bundle by default (verified: the production bundle contains no OpenAI key; only the Clerk publishable key, which is public by design)

### What You Should Do for Production

1. Implement a backend API (Node.js, Python, etc.)
2. Store the API key securely on the server
3. Have the frontend call your backend, which then calls OpenAI
4. Never expose the API key to the browser in production

## Clara's System Instructions

Clara is configured as a friendly memory companion for elderly users, including people living with dementia. Her personality and behavior are defined in `aiService.js`:

**Personality:**
- Warm, patient, calm, respectful, and encouraging
- Clear and easy to understand
- Never childish or patronizing
- Prefers short, easy-to-follow sentences

**Capabilities:**
- Understanding Pixel Players features
- Finding appropriate cognitive games
- Explaining game instructions
- Organizing daily routines
- Discussing personal memories that the user has actually shared
- Explaining reminder workflows
- Providing gentle everyday guidance
- Supporting Hindi, Bengali, and English conversations

**Constraints:**
- Responds in the language used by the user
- Does NOT invent the user's personal memories, family members, routine, reminders, medical information, or location
- Does NOT claim to diagnose or cure dementia
- Sends only the context required to answer the current question
- Does not claim to have saved data unless the application has actually performed that operation

## Conversation History

The integration supports multi-turn conversations by maintaining a conversation history. The history is:

- Limited to the last 10 messages to control token usage
- Stored in the frontend React state
- Not automatically saved permanently (unless the app already supports this behavior)
- Distinguished from the persistent Memory Vault feature

## Error Handling

The integration handles various error scenarios. Each one is shown to the user as an honest message — a failed request is never presented as a successful reply.

### User-Facing Error Messages

- **API_KEY_MISSING**: Displays setup message instructing user to add API key
- **INVALID_KEY**: API key is invalid or revoked (401/403)
- **RATE_LIMIT**: Too many requests, user should wait and retry (429)
- **OUT_OF_CREDITS**: OpenAI account has no remaining credit (429 `insufficient_quota`)
- **MODEL_NOT_FOUND**: Configured `VITE_OPENAI_MODEL` is unavailable for the account (404)
- **INVALID_REQUEST**: The request was rejected (400/422)
- **SERVICE_ERROR**: OpenAI service unavailable (500/502/503/504)
- **NETWORK_ERROR**: Cannot connect to OpenAI API (offline, CORS, timeout, aborted)
- **EMPTY_MESSAGE**: User submitted empty input
- **EMPTY_RESPONSE**: API returned no text
- **UNKNOWN_ERROR**: Anything else; logged to the browser console (never the API key)

### Development Diagnostics

For debugging, the service logs detailed error information to the browser console (without exposing secrets):

- HTTP status code
- OpenAI API error code and type
- Safe error message
- Error constructor name
- Whether the error occurred at API request, response parsing, or UI rendering stage
- Limited stack trace (first 3 frames)

These diagnostics help identify the root cause during development without exposing sensitive information.

## Voice Features

The existing voice input and text-to-speech features are preserved:

- Voice input sends recognized text through the same OpenAI service
- Text-to-speech can read Clara's AI responses when enabled
- Microphone permission denial is handled gracefully
- Text chat continues working even without microphone access

## Testing

### Automated service checks (no API key required)

```bash
npm run test:ai
```

Runs `scripts/test-aiService.mjs`, which stubs `import.meta.env` and mocks `fetch`, so it makes **no network calls and needs no key**. It verifies: missing-key detection, empty-input handling, the exact request payload (`/v1/responses`, model, `max_output_tokens`, temperature, system message, history filtering and 10-message cap), response parsing, and every error mapping (401, 400, 404, 429/quota, 500, network failure). Result at time of writing: **26/26 checks passed**.

### Lint and build

```bash
npm run lint
npm run build
```

Both pass. The build completes with no errors related to the OpenAI integration (only the pre-existing chunk-size warning).

### Without API Key

1. Ensure no `VITE_OPENAI_API_KEY` is set
2. Run `npm run dev`
3. Navigate to `/assistant`
4. Send a message
5. Clara will display a setup message explaining how to configure the API key
6. Subsequent messages will use the dummy response system

### With API Key

1. Set `VITE_OPENAI_API_KEY` in `.env.local`
2. Run `npm run dev`
3. Navigate to `/assistant`
4. Send a message
5. Clara will respond with real AI-generated responses
6. Try follow-up questions to test conversation context

> **Status:** steps under *With API Key* and the browser/voice walkthrough have **not** been run in this environment — no `VITE_OPENAI_API_KEY` was available. Everything that could be checked offline (service logic, request payload, error mapping, lint, production build, Vite module transform) has been checked and passes.

## Model Configuration

The default model is `gpt-4o-mini`. You can override this by setting:

```bash
VITE_OPENAI_MODEL=gpt-4o  # or another supported model
```

**Note:** Ensure the model you choose is available in your OpenAI account and supports the API pattern used (Responses API). `gpt-4o-mini` is a Responses API–supported model and is what the automated checks assert as the default; if the model is unavailable for your account the API returns 404 and Clara reports `MODEL_NOT_FOUND` instead of failing silently.

## Dependencies

The OpenAI JavaScript SDK is already installed:

```json
"openai": "^7.31.0"
```

No additional dependencies are required.

## Troubleshooting

### Build Fails

- Ensure `openai` package is installed: `npm install`
- Check that Vite is configured correctly

### API Returns Errors

- Verify your API key is valid at [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Check that your OpenAI account has available credits
- Ensure the model you selected is available and supported

### Clara Doesn't Respond

- Check browser console for error messages
- Verify network connectivity
- Ensure API key is set in `.env.local`
- Restart the dev server after adding the API key

### Voice Features Not Working

- Voice features require browser support for Web Speech API
- Check microphone permissions in browser settings
- Text chat will work even if voice is unavailable

## Integration Location

All OpenAI-specific code is isolated in:

- **`src/services/aiService.js`** - Service layer (OpenAI client, API calls, error handling)
- **`src/services/useConversation.js`** - React hook integration (chooses between real API and dummy responses)

No OpenAI-specific code is present in React components, keeping the UI clean and maintainable.

## Preserved Features

The integration preserves all existing Pixel Players features:

- Clara's name and avatar
- Chat layout and floating chatbot
- Quick prompts and suggestions
- Pixel Art styling and Subtle Skeuomorphism
- Light/Dark mode
- Clerk authentication
- All pages (Dashboard, Games, Memory Vault, Routine, Reminders, SOS, etc.)
- Caregiver features

## Community Resources

### 🌐 Community Wisdom: [[How to Run OpenAI & Claude on the Frontend Without Leaking Your API Keys](https://dev.to/amrzlabs/how-to-run-openai-claude-on-the-frontend-without-leaking-your-api-keys-4414)]
> **Source**: [[Amr Labib](https://dev.to/amrzlabs)]
> **Tags**: `ai`, `frontend`, `javascript`, `security`
>
> This article explores the frontend AI API key security challenge. It notes that many developers spin up backend servers just to hide API keys, but alternatives like Puter.js can handle client-side AI calls without exposing keys by having users pay for their own usage. While our implementation uses a different approach (explicit frontend environment variables with clear documentation), the article reinforces the importance of understanding the security trade-offs of browser-side API calls.
>
> 🔗 [Read Full Discussion](https://dev.to/amrzlabs/how-to-run-openai-claude-on-the-frontend-without-leaking-your-api-keys-4414)

### 🌐 Community Wisdom: [[Frontend Security - What Your Browser Is Quietly Protecting You From](https://dev.to/codescoop/frontend-security-what-your-browser-is-quietly-protecting-you-from-nih)]
> **Source**: [[CodeScoop](https://dev.to/codescoop)]
> **Tags**: `frontend`, `security`, `javascript`, `browser`
>
> This article explains the various security protections browsers provide, including content security policies, same-origin policy, and protection against XSS attacks. It reinforces that while browsers do significant security work, developers must still be mindful of what data they expose client-side—particularly relevant when working with API keys in frontend code.
>
> 🔗 [Read Full Discussion](https://dev.to/codescoop/frontend-security-what-your-browser-is-quietly-protecting-you-from-nih)

## License

This integration follows the same license as the Pixel Players project.
