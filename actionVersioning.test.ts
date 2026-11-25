/**
 * Unit tests for actionVersioning.ts
 *
 * Run with:  npx tsx --test actionVersioning.test.ts
 *   (Node.js built-in test runner, available since Node 18)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseSemver,
  isValidSemver,
  compareSemver,
  getAvailableActions,
  FALLBACK_VERSION,
  CHAT_ACTIONS_MIN_VERSION,
} from "./actionVersioning";

// ---------------------------------------------------------------------------
// parseSemver
// ---------------------------------------------------------------------------

describe("parseSemver", () => {
  it("parses a valid version", () => {
    assert.deepEqual(parseSemver("1.4.0"), [1, 4, 0]);
  });

  it("parses a version with leading zeros in patch", () => {
    assert.deepEqual(parseSemver("2.10.3"), [2, 10, 3]);
  });

  it("ignores pre-release suffix", () => {
    assert.deepEqual(parseSemver("1.50.0-beta.1"), [1, 50, 0]);
  });

  it("returns null for empty string", () => {
    assert.equal(parseSemver(""), null);
  });

  it("returns null for undefined", () => {
    assert.equal(parseSemver(undefined), null);
  });

  it("returns null for null", () => {
    assert.equal(parseSemver(null), null);
  });

  it("returns null for invalid format", () => {
    assert.equal(parseSemver("not-a-version"), null);
  });

  it("returns null for partial version", () => {
    assert.equal(parseSemver("1.4"), null);
  });
});

// ---------------------------------------------------------------------------
// isValidSemver
// ---------------------------------------------------------------------------

describe("isValidSemver", () => {
  it("returns true for valid semver", () => {
    assert.equal(isValidSemver("1.50.0"), true);
  });

  it("returns false for missing version", () => {
    assert.equal(isValidSemver(undefined), false);
  });

  it("returns false for null", () => {
    assert.equal(isValidSemver(null), false);
  });

  it("returns false for empty string", () => {
    assert.equal(isValidSemver(""), false);
  });

  it("returns false for non-semver string", () => {
    assert.equal(isValidSemver("abc"), false);
  });
});

// ---------------------------------------------------------------------------
// compareSemver
// ---------------------------------------------------------------------------

describe("compareSemver", () => {
  it("returns 0 for equal versions", () => {
    assert.equal(compareSemver("1.4.0", "1.4.0"), 0);
  });

  it("returns 1 when first is greater (major)", () => {
    assert.equal(compareSemver("2.0.0", "1.9.9"), 1);
  });

  it("returns -1 when first is smaller (major)", () => {
    assert.equal(compareSemver("1.0.0", "2.0.0"), -1);
  });

  it("returns 1 when first is greater (minor)", () => {
    assert.equal(compareSemver("1.5.0", "1.4.9"), 1);
  });

  it("returns -1 when first is smaller (minor)", () => {
    assert.equal(compareSemver("1.3.0", "1.4.0"), -1);
  });

  it("returns 1 when first is greater (patch)", () => {
    assert.equal(compareSemver("1.4.1", "1.4.0"), 1);
  });

  it("returns -1 when first is smaller (patch)", () => {
    assert.equal(compareSemver("1.4.0", "1.4.1"), -1);
  });
});

// ---------------------------------------------------------------------------
// getAvailableActions
// ---------------------------------------------------------------------------

describe("getAvailableActions — baseline", () => {
  it("returns a non-empty set for a known version", () => {
    const actions = getAvailableActions("1.0.0");
    assert.ok(actions.size > 0, "Expected at least one action");
  });

  it("includes all tools with minVersion <= 1.0.0 for version 1.0.0", () => {
    const actions = getAvailableActions("1.0.0");
    for (const [name, minVersion] of Object.entries(CHAT_ACTIONS_MIN_VERSION)) {
      const { compareSemver: cmp } = require("./actionVersioning") as typeof import("./actionVersioning");
      if (cmp("1.0.0", minVersion) >= 0) {
        assert.ok(actions.has(name), `Expected tool '${name}' to be available at 1.0.0`);
      }
    }
  });
});

describe("getAvailableActions — no version provided", () => {
  it("falls back gracefully for undefined", () => {
    const actions = getAvailableActions(undefined);
    assert.ok(actions.size > 0, "Fallback should enable basic actions");
  });

  it("falls back gracefully for null", () => {
    const actions = getAvailableActions(null);
    assert.ok(actions.size > 0);
  });

  it("falls back gracefully for empty string", () => {
    const actions = getAvailableActions("");
    assert.ok(actions.size > 0);
  });

  it("fallback produces the same result as FALLBACK_VERSION", () => {
    const withFallback = getAvailableActions(undefined);
    const explicit   = getAvailableActions(FALLBACK_VERSION);
    assert.deepEqual([...withFallback].sort(), [...explicit].sort());
  });
});

describe("getAvailableActions — invalid format", () => {
  it("treats invalid semver as fallback version", () => {
    const invalid  = getAvailableActions("not-a-version");
    const fallback = getAvailableActions(FALLBACK_VERSION);
    assert.deepEqual([...invalid].sort(), [...fallback].sort());
  });

  it("treats partial version as fallback", () => {
    const partial  = getAvailableActions("1.4");
    const fallback = getAvailableActions(FALLBACK_VERSION);
    assert.deepEqual([...partial].sort(), [...fallback].sort());
  });
});

describe("getAvailableActions — version gating", () => {
  it("older version gets fewer or equal actions than newer version", () => {
    // Currently all tools are at 1.0.0, so both return the same set.
    // This test will catch future regressions if min-versions are raised.
    const older = getAvailableActions("0.9.0");
    const newer = getAvailableActions("2.0.0");
    // Every action available in older should also be available in newer.
    for (const name of older) {
      assert.ok(newer.has(name), `Tool '${name}' available in 0.9.0 but missing in 2.0.0`);
    }
  });

  it("very old version (0.1.0) gets fewer or equal actions than 1.0.0", () => {
    const veryOld = getAvailableActions("0.1.0");
    const current = getAvailableActions("1.0.0");
    for (const name of veryOld) {
      assert.ok(current.has(name), `Tool '${name}' in 0.1.0 must also be in 1.0.0`);
    }
  });

  it("very high version gets all currently registered tools", () => {
    const all = getAvailableActions("99.0.0");
    for (const name of Object.keys(CHAT_ACTIONS_MIN_VERSION)) {
      assert.ok(all.has(name), `Expected '${name}' to be available at 99.0.0`);
    }
  });
});
