/**
 * Pure helpers for the proactive greeting endpoint — no `config`/SDK imports, so
 * they can be unit-tested in isolation (importing `config` instantiates the
 * OpenAI client, which needs credentials).
 */

export interface GreetingSuggestion {
  type: string;
  actionType: "suggested";
  label: string;
  icon?: string;
  payload?: Record<string, unknown>;
}

export interface GreetingResult {
  greeting: string;
  suggestions: GreetingSuggestion[];
}

/**
 * Tools the greeting generator may use. Deliberately narrow (token cost + safety):
 * read-only analysis tools plus the two suggestion-producing actions. Everything
 * else from the chat registry is withheld so the greeting can only ever *propose*.
 */
export const GREETING_TOOL_NAMES = new Set<string>([
  // read-only analysis
  "get_user_info",
  "get_invoices",
  "get_close_month_status",
  "get_dashboard",
  // suggestion actions (coerced to actionType "suggested" by the handler)
  "open_income_form",
  "approve_month",
]);

/** Previous calendar month as `{ ym: "YYYY-MM", action: "YYYY-M" }` relative to `now`. */
export function previousMonth(now: Date): { ym: string; action: string } {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const y = prev.getFullYear();
  const m = prev.getMonth() + 1;
  return { ym: `${y}-${String(m).padStart(2, "0")}`, action: `${y}-${m}` };
}
