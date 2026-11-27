import OpenAI from "openai";
import * as Sentry from "@sentry/node";

// Load .env if present (gitignored). Variables already set in the environment win.
try { process.loadEnvFile(); } catch { /* no .env file */ }

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "https://1bee4f2f69d733a16b03194925256048@o4509706346102784.ingest.de.sentry.io/4509728382124112",
  environment: process.env.NODE_ENV ?? "production",
});

export { Sentry };

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const nodeEnv = process.env.NODE_ENV ?? "production";

export const config = {
  port: Number(env("PORT", "3000")),

  /** True on dev/local (NODE_ENV !== "production"). Gates verbose logging. */
  isDev: nodeEnv !== "production",

  /** Token-usage logging to PostgreSQL. Off unless USAGE_LOGGING=true. */
  usage: {
    enabled: env("USAGE_LOGGING", "false") === "true",
    databaseUrl: process.env.DATABASE_URL ?? "",
    hashSalt: env("USAGE_HASH_SALT", "mob-ask-ai"),
  },

  /** Text chat (`POST /chat`). */
  chatModel: env("OPENAI_CHAT_MODEL", "gpt-5.5"),
  /** Reasoning effort for reasoning models; set to "" to omit the parameter (e.g. for gpt-4.1). */
  chatReasoningEffort: process.env.OPENAI_CHAT_REASONING_EFFORT ?? "low",
  /** Includes reasoning tokens on reasoning models, so it is higher than the old 1024. */
  chatMaxOutputTokens: Number(env("OPENAI_CHAT_MAX_OUTPUT_TOKENS", "4096")),

  /**
   * Proactive greeting (`POST /greeting`). A one-shot generation that analyses the
   * user's data with a narrow read-only toolset and returns a short personalised
   * greeting plus up to N suggested actions. Tuned for low token cost.
   */
  greeting: {
    /** Cap on model output tokens per iteration (kept small — the greeting is short). */
    maxOutputTokens: Number(env("OPENAI_GREETING_MAX_OUTPUT_TOKENS", "700")),
    /** Reasoning effort; "minimal" keeps cost down. Set to "" to omit the parameter. */
    reasoningEffort: process.env.OPENAI_GREETING_REASONING_EFFORT ?? "minimal",
    /** Hard cap on agentic-loop iterations — bounds the number of model calls. */
    maxIterations: Number(env("OPENAI_GREETING_MAX_ITERATIONS", "4")),
    /** Maximum number of suggested actions returned to the app. */
    maxSuggestions: Number(env("OPENAI_GREETING_MAX_SUGGESTIONS", "3")),
    /** How many months back the model is told to look when detecting recurring invoices. */
    invoiceLookbackMonths: Number(env("OPENAI_GREETING_INVOICE_LOOKBACK_MONTHS", "6")),
  },

  /** Realtime voice (`/realtime`). */
  realtimeModel: env("OPENAI_REALTIME_MODEL", "gpt-realtime"),
  realtimeVoice: env("OPENAI_REALTIME_VOICE", "marin"),
  realtimeTranscriptionModel: env("OPENAI_REALTIME_TRANSCRIPTION_MODEL", "gpt-4o-transcribe"),
  realtimeUrl: env("OPENAI_REALTIME_URL", "wss://api.openai.com/v1/realtime"),
};

/** Reads OPENAI_API_KEY (and optional OPENAI_BASE_URL) from the environment. */
export const openai = new OpenAI();
