/**
 * Unit tests for greeting.ts helpers.
 *
 * Run with:  npx tsx --test greeting.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { GREETING_TOOL_NAMES, previousMonth } from "./greetingHelpers";

describe("previousMonth", () => {
  it("returns the previous month within the same year", () => {
    const r = previousMonth(new Date(2026, 10, 27)); // November 2026
    assert.equal(r.ym, "2026-10");
    assert.equal(r.action, "2026-10");
  });

  it("zero-pads single-digit months in the YYYY-MM form", () => {
    const r = previousMonth(new Date(2026, 8, 15)); // September 2026 → August
    assert.equal(r.ym, "2026-08");
    assert.equal(r.action, "2026-8");
  });

  it("wraps across the year boundary", () => {
    const r = previousMonth(new Date(2026, 0, 5)); // January 2026 → December 2025
    assert.equal(r.ym, "2025-12");
    assert.equal(r.action, "2025-12");
  });
});

describe("GREETING_TOOL_NAMES", () => {
  it("includes only read-only analysis + suggestion actions", () => {
    assert.ok(GREETING_TOOL_NAMES.has("get_user_info"));
    assert.ok(GREETING_TOOL_NAMES.has("get_invoices"));
    assert.ok(GREETING_TOOL_NAMES.has("get_close_month_status"));
    assert.ok(GREETING_TOOL_NAMES.has("open_income_form"));
    assert.ok(GREETING_TOOL_NAMES.has("approve_month"));
  });

  it("never exposes mutating or send actions", () => {
    assert.ok(!GREETING_TOOL_NAMES.has("create_invoice"));
    assert.ok(!GREETING_TOOL_NAMES.has("send_invoice"));
    assert.ok(!GREETING_TOOL_NAMES.has("create_contractor"));
    assert.ok(!GREETING_TOOL_NAMES.has("mark_invoice_as_accounted"));
  });
});
