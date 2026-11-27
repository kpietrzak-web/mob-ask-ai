/**
 * Versioned OpenAI price table + cost calculation.
 *
 * Prices are USD per 1,000,000 tokens. Keyed by model, each model holds an
 * ordered list of date-effective entries so historical usage can be repriced
 * accurately. Update via PR whenever OpenAI changes prices — keep the `source`
 * URL + verification date inline.
 *
 * Billing rules (OpenAI):
 *  - `input_tokens` INCLUDES cached tokens — price the fresh part at `input`
 *    and the cached part at `cachedInput`.
 *  - `output_tokens` INCLUDES reasoning tokens — never add reasoning on top.
 *  - Realtime audio tokens are billed with separate (much higher) rates.
 */

export interface ModalityRates {
  /** USD / 1M fresh input tokens. */
  input: number;
  /** USD / 1M cached input tokens. */
  cachedInput: number;
  /** USD / 1M output tokens. */
  output: number;
}

export interface ModelPrice {
  /** ISO date this price became effective. */
  effectiveFrom: string;
  /** Where the price was verified (url + date). */
  source: string;
  text: ModalityRates;
  /** Realtime / transcribe models only. */
  audio?: ModalityRates;
}

const SRC = "developers.openai.com/api/docs/pricing (verified 2026-11-27)";

export const PRICE_TABLE: Record<string, ModelPrice[]> = {
  "gpt-5.5": [
    {
      effectiveFrom: "2026-01-01",
      source: SRC,
      text: { input: 5.0, cachedInput: 0.5, output: 30.0 },
    },
  ],
  "gpt-5": [
    {
      effectiveFrom: "2026-01-01",
      source: SRC,
      text: { input: 1.25, cachedInput: 0.125, output: 10.0 },
    },
  ],
  "gpt-realtime": [
    {
      effectiveFrom: "2026-01-01",
      source: SRC,
      text: { input: 4.0, cachedInput: 0.4, output: 16.0 },
      audio: { input: 32.0, cachedInput: 0.4, output: 64.0 },
    },
  ],
  "gpt-4o-transcribe": [
    {
      effectiveFrom: "2026-01-01",
      source: SRC,
      text: { input: 2.5, cachedInput: 2.5, output: 10.0 },
      audio: { input: 6.0, cachedInput: 6.0, output: 6.0 },
    },
  ],
};

const UNKNOWN_PRICE_VERSION = "unknown";

/** Strip a dated snapshot suffix, e.g. `gpt-5.5-2026-01-15` -> `gpt-5.5`. */
function familyAlias(model: string): string {
  return model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

/**
 * Resolve the price entry for a model at a given time. Tries the exact model
 * string, then the family alias. Returns null (caller logs a warning and
 * stores cost 0) if the model is unknown — never silently guesses.
 */
export function resolvePrice(model: string, at: Date = new Date()): ModelPrice | null {
  const entries = PRICE_TABLE[model] ?? PRICE_TABLE[familyAlias(model)];
  if (!entries || entries.length === 0) return null;
  const iso = at.toISOString().slice(0, 10);
  const applicable = entries
    .filter((e) => e.effectiveFrom <= iso)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return applicable[0] ?? entries[0];
}

export interface ChatTokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number } | null;
  output_tokens_details?: { reasoning_tokens?: number } | null;
}

export interface CostResult {
  costUsd: number;
  priceVersion: string;
}

/** Cost for a text (Responses API) model call. */
export function computeChatCost(model: string, usage: ChatTokenUsage, at?: Date): CostResult {
  const price = resolvePrice(model, at);
  if (!price) return { costUsd: 0, priceVersion: UNKNOWN_PRICE_VERSION };

  const input = usage.input_tokens ?? 0;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const fresh = Math.max(0, input - cached);

  const costUsd =
    (fresh * price.text.input + cached * price.text.cachedInput + output * price.text.output) /
    1_000_000;

  return { costUsd, priceVersion: price.effectiveFrom };
}

export interface RealtimeTokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_token_details?: {
    text_tokens?: number;
    audio_tokens?: number;
    cached_tokens?: number;
    cached_tokens_details?: { text_tokens?: number; audio_tokens?: number } | null;
  } | null;
  output_token_details?: { text_tokens?: number; audio_tokens?: number } | null;
}

/** Cost for a Realtime (voice) model call — text + audio priced separately. */
export function computeRealtimeCost(model: string, usage: RealtimeTokenUsage, at?: Date): CostResult {
  const price = resolvePrice(model, at);
  if (!price || !price.audio) return { costUsd: 0, priceVersion: UNKNOWN_PRICE_VERSION };

  const inDetails = usage.input_token_details ?? {};
  const outDetails = usage.output_token_details ?? {};
  const inText = inDetails.text_tokens ?? 0;
  const inAudio = inDetails.audio_tokens ?? 0;
  const cachedText = inDetails.cached_tokens_details?.text_tokens ?? 0;
  const cachedAudio = inDetails.cached_tokens_details?.audio_tokens ?? 0;
  const outText = outDetails.text_tokens ?? 0;
  const outAudio = outDetails.audio_tokens ?? 0;

  const freshText = Math.max(0, inText - cachedText);
  const freshAudio = Math.max(0, inAudio - cachedAudio);

  const costUsd =
    (freshText * price.text.input +
      cachedText * price.text.cachedInput +
      freshAudio * price.audio.input +
      cachedAudio * price.audio.cachedInput +
      outText * price.text.output +
      outAudio * price.audio.output) /
    1_000_000;

  return { costUsd, priceVersion: price.effectiveFrom };
}
