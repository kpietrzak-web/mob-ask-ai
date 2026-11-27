import { config } from "./config";

/**
 * Dev-only logging.
 *
 * The informational `console.log` / `console.warn` lines in this server print
 * message content, tool arguments, user emails and other PII. They are useful
 * for local debugging but must NOT run in production. `devLog` / `devWarn`
 * emit only when `config.isDev` is true (NODE_ENV !== "production").
 *
 * Genuine errors still use `console.error` directly (and Sentry) so they are
 * always visible in production.
 */

export function devLog(...args: unknown[]): void {
  if (config.isDev) console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (config.isDev) console.warn(...args);
}
