import { createHmac, randomUUID } from "node:crypto";
import { config } from "../config";

/**
 * Non-reversible reference for a user/tenant: HMAC-SHA256 truncated to 16 bytes
 * hex. Keeps "cost per user/tenant" analysis possible without storing any PII.
 * The salt lives in `USAGE_HASH_SALT` (env), never in the repo.
 */
export function hashRef(value: string | undefined | null): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;

  return "h:" + createHmac("sha256", config.usage.hashSalt).update(v).digest("hex").slice(0, 32);
}

/** A fresh id when the client does not supply one. */
export function newId(): string {
  return randomUUID();
}
