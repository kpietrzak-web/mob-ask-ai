import { Pool } from "pg";
import { config } from "../config";
import { Sentry } from "../config";
import { devWarn } from "../logger";
import type { UsageEvent } from "./types";

/**
 * Buffered, fire-and-forget writer for LLM usage events.
 *
 * When `config.usage.enabled` is false this module is inert — no pool is
 * created and `recordUsage` is a no-op, so the chat path has zero overhead.
 * When enabled, events are buffered in memory and flushed in batches; a DB
 * failure is logged (and sent to Sentry once) but never breaks the chat.
 */

const FLUSH_INTERVAL_MS = 2000;
const FLUSH_BATCH_SIZE = 50;
const MAX_BUFFER = 5000;

let pool: Pool | null = null;
let buffer: UsageEvent[] = [];
let timer: NodeJS.Timeout | null = null;
let flushing = false;
let dbErrorReported = false;

const DDL = `
CREATE TABLE IF NOT EXISTS llm_usage_events (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  channel             TEXT         NOT NULL,
  model               TEXT         NOT NULL,
  conversation_id     TEXT         NOT NULL,
  message_id          TEXT         NOT NULL,
  iteration           INT          NOT NULL DEFAULT 0,
  user_ref            TEXT,
  tenant_ref          TEXT,
  screen              TEXT,
  app_build           INT,
  input_tokens        INT          NOT NULL DEFAULT 0,
  cached_input_tokens INT          NOT NULL DEFAULT 0,
  output_tokens       INT          NOT NULL DEFAULT 0,
  reasoning_tokens    INT          NOT NULL DEFAULT 0,
  audio_input_tokens  INT          NOT NULL DEFAULT 0,
  audio_output_tokens INT          NOT NULL DEFAULT 0,
  total_tokens        INT          NOT NULL DEFAULT 0,
  tool_calls          TEXT[]       NOT NULL DEFAULT '{}',
  action_types        TEXT[]       NOT NULL DEFAULT '{}',
  action_direct       BOOLEAN      NOT NULL DEFAULT false,
  cost_usd            NUMERIC(12,6) NOT NULL DEFAULT 0,
  price_version       TEXT,
  latency_ms          INT,
  incomplete          BOOLEAN      NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS llm_usage_events_ts_idx           ON llm_usage_events (ts);
CREATE INDEX IF NOT EXISTS llm_usage_events_conversation_idx ON llm_usage_events (conversation_id);
CREATE INDEX IF NOT EXISTS llm_usage_events_user_idx         ON llm_usage_events (user_ref);
`;

/** Called once on startup. Creates the pool and ensures the table exists. */
export async function initUsageLogger(): Promise<void> {
  if (!config.usage.enabled) return;
  if (!config.usage.databaseUrl) {
    devWarn("[usage] USAGE_LOGGING is on but DATABASE_URL is empty — logging disabled");
    return;
  }

  pool = new Pool({ connectionString: config.usage.databaseUrl, max: 4 });
  try {
    await pool.query(DDL);
  } catch (err) {
    reportDbError("schema init failed", err);
  }

  timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  if (timer.unref) timer.unref();
}

/** Fire-and-forget: buffer an event. Never throws. */
export function recordUsage(event: UsageEvent): void {
  if (!pool) return;
  if (buffer.length >= MAX_BUFFER) {
    buffer.shift();
  }
  buffer.push(event);
  if (buffer.length >= FLUSH_BATCH_SIZE) void flush();
}

async function flush(): Promise<void> {
  if (!pool || flushing || buffer.length === 0) return;
  flushing = true;
  const batch = buffer.splice(0, FLUSH_BATCH_SIZE);

  try {
    await insertBatch(pool, batch);
  } catch (err) {
    reportDbError("flush failed", err);
  } finally {
    flushing = false;
  }
}

const COLUMNS = [
  "channel", "model", "conversation_id", "message_id", "iteration",
  "user_ref", "tenant_ref", "screen", "app_build",
  "input_tokens", "cached_input_tokens", "output_tokens", "reasoning_tokens",
  "audio_input_tokens", "audio_output_tokens", "total_tokens",
  "tool_calls", "action_types", "action_direct",
  "cost_usd", "price_version", "latency_ms", "incomplete",
];

async function insertBatch(p: Pool, batch: UsageEvent[]): Promise<void> {
  const values: unknown[] = [];
  const rows = batch.map((e, r) => {
    const base = r * COLUMNS.length;
    const ph = COLUMNS.map((_, c) => `$${base + c + 1}`).join(", ");
    values.push(
      e.channel, e.model, e.conversationId, e.messageId, e.iteration,
      e.userRef, e.tenantRef, e.screen, e.appBuild,
      e.inputTokens, e.cachedInputTokens, e.outputTokens, e.reasoningTokens,
      e.audioInputTokens, e.audioOutputTokens, e.totalTokens,
      e.toolCalls, e.actionTypes, e.actionDirect,
      e.costUsd, e.priceVersion, e.latencyMs, e.incomplete
    );

    return `(${ph})`;
  });

  await p.query(`INSERT INTO llm_usage_events (${COLUMNS.join(", ")}) VALUES ${rows.join(", ")}`, values);
}

function reportDbError(context: string, err: unknown): void {
  devWarn(`[usage] ${context}:`, err);
  if (!dbErrorReported) {
    dbErrorReported = true;
    Sentry.captureException(err, { extra: { context: `usage: ${context}` } });
  }
}

/** Flush remaining events on shutdown. */
export async function shutdownUsageLogger(): Promise<void> {
  if (timer) clearInterval(timer);
  while (pool && buffer.length > 0) await flush();
  await pool?.end();
  pool = null;
}
