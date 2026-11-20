import OpenAI from "openai";

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export const config = {
  port: Number(env("PORT", "3000")),

  /** Text chat (`POST /chat`). */
  chatModel: env("OPENAI_CHAT_MODEL", "gpt-5.5"),
  /** Reasoning effort for reasoning models; set to "" to omit the parameter (e.g. for gpt-4.1). */
  chatReasoningEffort: process.env.OPENAI_CHAT_REASONING_EFFORT ?? "low",
  /** Includes reasoning tokens on reasoning models, so it is higher than the old 1024. */
  chatMaxCompletionTokens: Number(env("OPENAI_CHAT_MAX_COMPLETION_TOKENS", "4096")),

  /** Realtime voice (`/realtime`). */
  realtimeModel: env("OPENAI_REALTIME_MODEL", "gpt-realtime"),
  realtimeVoice: env("OPENAI_REALTIME_VOICE", "marin"),
  realtimeTranscriptionModel: env("OPENAI_REALTIME_TRANSCRIPTION_MODEL", "gpt-4o-transcribe"),
  realtimeUrl: env("OPENAI_REALTIME_URL", "wss://api.openai.com/v1/realtime"),
};

/** Reads OPENAI_API_KEY (and optional OPENAI_BASE_URL) from the environment. */
export const openai = new OpenAI();
