/**
 * Offline verification for src/services/aiService.js
 *
 * Run: node scripts/test-aiService.mjs   (or: npm run test:ai)
 *
 * - Replaces Vite's `import.meta.env` reads with test globals (no real keys used).
 * - Mocks global fetch, so no network calls and no OpenAI account are required.
 * - Covers: missing key, empty input, request payload (Chat Completions API),
 *   conversation-history filtering, response parsing, and error mapping.
 *
 * This does NOT replace a live end-to-end test with a real VITE_OPENAI_API_KEY.
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(scriptDir, "..");
const srcPath = path.join(root, "src", "services", "aiService.js");
const raw = readFileSync(srcPath, "utf8");

const noKeyFile = path.join(scriptDir, ".aiService.nokey.generated.mjs");
const keyedFile = path.join(scriptDir, ".aiService.keyed.generated.mjs");

function cleanup() {
  for (const file of [noKeyFile, keyedFile]) {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        /* best effort */
      }
    }
  }
}
process.on("exit", cleanup);

writeFileSync(noKeyFile, raw
  .replace(/import\.meta\.env\.VITE_OPENAI_API_KEY/g, "globalThis.__ENV_NOKEY__.key")
  .replace(/import\.meta\.env\.VITE_OPENAI_MODEL/g, "globalThis.__ENV_NOKEY__.model"));
writeFileSync(keyedFile, raw
  .replace(/import\.meta\.env\.VITE_OPENAI_API_KEY/g, "globalThis.__ENV_KEYED__.key")
  .replace(/import\.meta\.env\.VITE_OPENAI_MODEL/g, "globalThis.__ENV_KEYED__.model"));

let results = 0;
let failures = 0;
function check(name, cond, extra = "") {
  results += 1;
  if (cond) console.log(`PASS  ${name}`);
  else {
    failures += 1;
    console.log(`FAIL  ${name}${extra ? ` :: ${extra}` : ""}`);
  }
}

const okBody = {
  id: "chatcmpl_test",
  object: "chat.completion",
  created: 1234567890,
  model: "gpt-4o-mini",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "Hello! I am Clara.",
      },
      finish_reason: "stop",
    },
  ],
};

let lastRequest = null;
let nextHandler = null;

globalThis.fetch = async (url, init) => {
  lastRequest = { url: String(url), body: init?.body ? JSON.parse(init.body) : null };
  if (!nextHandler) throw new Error("test handler not set");
  return nextHandler();
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

globalThis.__ENV_NOKEY__ = { key: "", model: "" };
globalThis.__ENV_KEYED__ = { key: "sk-test-fake-key", model: "" };

try {
  const svcNoKey = await import("./.aiService.nokey.generated.mjs");
  const svc = await import("./.aiService.keyed.generated.mjs");

  // 1. Missing API key
  check("isConfigured() false without key", svcNoKey.isConfigured() === false);
  const noKey = await svcNoKey.getAIResponse("hello", {});
  check("API_KEY_MISSING when no key", noKey.success === false && noKey.error === "API_KEY_MISSING", JSON.stringify(noKey));
  check("configured() true with key", svc.isConfigured() === true);

  // 2. Empty message short-circuits before any request
  const emptyMsg = await svc.getAIResponse("   ", { user: { name: "Maya" } });
  check("EMPTY_MESSAGE for blank input", emptyMsg.success === false && emptyMsg.error === "EMPTY_MESSAGE", JSON.stringify(emptyMsg));

  // 3. Success path + request payload verification
  nextHandler = () => jsonResponse(200, okBody);
  const history = [
    { role: "ai", text: "Welcome back!", context: "greeting" },
    { role: "user", text: "setup instructions", context: "setup" },
    { role: "user", text: "Tell me a memory", context: "memory" },
    { role: "ai", text: "You saved knitting.", context: "memory" },
  ];
  const ok = await svc.getAIResponse(
    "Hello Clara",
    {
      user: { name: "Maya" },
      memories: [{ title: "Knitting", description: "shawls", favorite: true }],
      routine: [{ id: "r1", completed: false, title: "Walk" }],
      reminders: [{ id: "d1", important: true, completed: false, title: "Meds" }],
      games: [{ name: "Picture Recall", href: "/games/picture", duration: "5m", skillTarget: "Memory" }],
      currentTime: new Date("2026-10-09T10:30:00"),
    },
    history
  );
  check("success response parsed", ok.success === true && ok.text === "Hello! I am Clara.", JSON.stringify(ok));

  const body = lastRequest?.body;
  check("hits chat completions endpoint", /\/v1\/chat\/completions$/.test(lastRequest?.url || ""), lastRequest?.url);
  check("uses configured model default", body?.model === "gpt-4o-mini", String(body?.model));
  check("uses max_tokens (not max_output_tokens)", body?.max_tokens === 500 && !("max_output_tokens" in (body || {})));
  check("temperature preserved", body?.temperature === 0.7);

  const messages = body?.messages || [];
  check("system message first", messages[0]?.role === "system", JSON.stringify(messages[0]?.role));
  check("system carries user name", String(messages[0]?.content).includes("User name: Maya"));
  check(
    "setup message excluded from history",
    !messages.some((m) => String(m.content).includes("setup instructions")),
    JSON.stringify(messages.map((m) => `${m.role}:${String(m.content).slice(0, 30)}`))
  );
  check("history turns replayed", messages.some((m) => m.role === "assistant" && m.content === "You saved knitting."));
  check("current user message last", messages[messages.length - 1]?.role === "user" && messages[messages.length - 1]?.content === "Hello Clara");
  check("history capped at 10", messages.length <= 12, String(messages.length));

  // 4. Empty model output
  nextHandler = () => jsonResponse(200, { id: "chatcmpl_empty", object: "chat.completion", choices: [] });
  const emptyRes = await svc.getAIResponse("hi", {});
  check("EMPTY_RESPONSE when model returns nothing", emptyRes.success === false && emptyRes.error === "EMPTY_RESPONSE", JSON.stringify(emptyRes));

  // 5. Invalid key (401)
  nextHandler = () => jsonResponse(401, { error: { message: "Incorrect API key provided", type: "invalid_request_error", code: "invalid_api_key" } });
  const badKey = await svc.getAIResponse("hi", {});
  check("INVALID_KEY on 401", badKey.success === false && badKey.error === "INVALID_KEY", JSON.stringify(badKey));
  check("error text never contains the key", !JSON.stringify(badKey).includes("sk-test-fake-key"));

  // 6. Quota exhausted (429)
  nextHandler = () => jsonResponse(429, { error: { message: "You exceeded your current quota.", type: "insufficient_quota", code: "insufficient_quota" } });
  const quota = await svc.getAIResponse("hi", {});
  check("OUT_OF_CREDITS on quota 429", quota.success === false && quota.error === "OUT_OF_CREDITS", JSON.stringify(quota));

  // 7. Rate limit (429 without quota code)
  nextHandler = () => jsonResponse(429, { error: { message: "Rate limit reached", type: "requests", code: "rate_limit_exceeded" } });
  const rate = await svc.getAIResponse("hi", {});
  check("RATE_LIMIT on plain 429", rate.success === false && rate.error === "RATE_LIMIT", JSON.stringify(rate));

  // 8. Service error (500)
  nextHandler = () => jsonResponse(500, { error: { message: "The server had an error", type: "server_error" } });
  const server = await svc.getAIResponse("hi", {});
  check("SERVICE_ERROR on 500", server.success === false && server.error === "SERVICE_ERROR", JSON.stringify(server));

  // 9. Bad request (400)
  nextHandler = () => jsonResponse(400, { error: { message: "Invalid parameter", type: "invalid_request_error", param: "input" } });
  const badReq = await svc.getAIResponse("hi", {});
  check("INVALID_REQUEST on 400", badReq.success === false && badReq.error === "INVALID_REQUEST", JSON.stringify(badReq));

  // 10. Unknown model (404)
  nextHandler = () => jsonResponse(404, { error: { message: "The model does not exist", type: "invalid_request_error", code: "model_not_found" } });
  const missingModel = await svc.getAIResponse("hi", {});
  check("MODEL_NOT_FOUND on 404", missingModel.success === false && missingModel.error === "MODEL_NOT_FOUND", JSON.stringify(missingModel));

  // 11. Network failure (APIConnectionError from OpenAI SDK)
  nextHandler = () => {
    const err = new Error("Connection error.");
    err.name = "APIConnectionError";
    err.constructor = { name: "APIConnectionError" };
    throw err;
  };
  const netErr = await svc.getAIResponse("hi", {});
  check("NETWORK_ERROR on fetch failure", netErr.success === false && netErr.error === "NETWORK_ERROR", JSON.stringify(netErr));

  // 12. Malformed/partial app data must not crash the request builder
  nextHandler = () => jsonResponse(200, okBody);
  const partial = await svc.getAIResponse("hi", { memories: undefined, routine: null, games: [null], reminders: "nope" });
  check("partial app data tolerated", partial.success === true, JSON.stringify(partial));

  // 13. Setup message is available
  check("setup message mentions env var", svc.getSetupMessage().includes("VITE_OPENAI_API_KEY"));
} finally {
  cleanup();
}

console.log(`\n${results - failures}/${results} checks passed`);
if (failures > 0) process.exit(1);
