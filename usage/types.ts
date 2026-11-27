/**
 * Types for LLM token-usage logging.
 *
 * One `UsageEvent` = one model invocation. For the text chat that is one
 * iteration of the agentic loop; for voice it is one `response.done`.
 * Raw token counts + a computed cost are stored so every reporting level
 * (per message / per conversation / per action) can be derived later with SQL.
 *
 * No message content, tool arguments or PII is ever stored here.
 */

export type UsageChannel = "chat" | "voice" | "voice_transcribe";

export interface UsageEvent {
  /** `chat` | `voice` | `voice_transcribe`. */
  channel: UsageChannel;
  /** Exact model string returned by the API (e.g. `gpt-5.5`). */
  model: string;
  /** Conversation / session id (from a client header, or generated). */
  conversationId: string;
  /** User-turn id (one HTTP request for chat, one response for voice). */
  messageId: string;
  /** Agentic-loop iteration index within the turn (0-based). */
  iteration: number;
  /** HMAC of the user token / email — stable, non-reversible, no PII. */
  userRef: string | null;
  /** HMAC of the tenant api url — no PII. */
  tenantRef: string | null;
  /** Screen context key (low cardinality), e.g. `filters_incomes_list`. */
  screen: string | null;
  /** App build code from `X-App-Version`. */
  appBuild: number | null;

  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  /** Voice only. */
  audioInputTokens: number;
  /** Voice only. */
  audioOutputTokens: number;
  totalTokens: number;

  /** Tool names invoked in this model call (no arguments). */
  toolCalls: string[];
  /** Business action categories derived from `toolCalls`. */
  actionTypes: string[];
  /** Whether any emitted action used `actionType: "direct"`. */
  actionDirect: boolean;

  /** Computed cost in USD. */
  costUsd: number;
  /** `effectiveFrom` of the price entry used — for audit. */
  priceVersion: string;
  /** Model-call latency in ms (optional). */
  latencyMs: number | null;
  /** Whether the response was truncated / incomplete. */
  incomplete: boolean;
}
