/**
 * Unit tests for actionVersioning.ts
 *
 * Run with:  npx tsx --test actionVersioning.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseBuildCode,
  isValidBuildCode,
  getAvailableActions,
  isOutdated,
  getMissingFeatures,
  FALLBACK_BUILD,
  LATEST_BUILD,
  CHAT_ACTIONS_MIN_BUILD,
} from "./actionVersioning";

// ---------------------------------------------------------------------------
// parseBuildCode
// ---------------------------------------------------------------------------

describe("parseBuildCode", () => {
  it("parses a valid build code", () => {
    assert.equal(parseBuildCode("150063"), 150063);
  });

  it("parses zero", () => {
    assert.equal(parseBuildCode("0"), 0);
  });

  it("returns null for undefined", () => {
    assert.equal(parseBuildCode(undefined), null);
  });

  it("returns null for null", () => {
    assert.equal(parseBuildCode(null), null);
  });

  it("returns null for empty string", () => {
    assert.equal(parseBuildCode(""), null);
  });

  it("returns null for non-numeric string", () => {
    assert.equal(parseBuildCode("abc"), null);
  });

  it("returns null for semver string", () => {
    assert.equal(parseBuildCode("1.50.0"), null);
  });
});

// ---------------------------------------------------------------------------
// isValidBuildCode
// ---------------------------------------------------------------------------

describe("isValidBuildCode", () => {
  it("returns true for valid build code", () => {
    assert.equal(isValidBuildCode("150063"), true);
  });

  it("returns false for undefined", () => {
    assert.equal(isValidBuildCode(undefined), false);
  });

  it("returns false for semver string", () => {
    assert.equal(isValidBuildCode("1.50.0"), false);
  });
});

// ---------------------------------------------------------------------------
// getAvailableActions
// ---------------------------------------------------------------------------

describe("getAvailableActions", () => {
  it("returns non-empty set for a known build", () => {
    const actions = getAvailableActions("150063");
    assert.ok(actions.size > 0);
  });

  it("falls back gracefully for undefined", () => {
    const actions = getAvailableActions(undefined);
    assert.ok(actions instanceof Set);
  });

  it("higher build gets same or more actions than lower build", () => {
    const older = getAvailableActions("100000");
    const newer = getAvailableActions("999999");
    for (const name of older) {
      assert.ok(newer.has(name), `Tool '${name}' in older build must also be in newer`);
    }
  });

  it("very high build gets all registered tools", () => {
    const all = getAvailableActions("999999");
    for (const name of Object.keys(CHAT_ACTIONS_MIN_BUILD)) {
      assert.ok(all.has(name), `Expected '${name}' to be available at build 999999`);
    }
  });

  it("build 0 (fallback) gets only minBuild=0 tools", () => {
    const actions = getAvailableActions("0");
    for (const [name, minBuild] of Object.entries(CHAT_ACTIONS_MIN_BUILD)) {
      if (minBuild === 0) {
        assert.ok(actions.has(name), `Expected '${name}' (minBuild=0) to be available at build 0`);
      } else {
        assert.ok(!actions.has(name), `Did not expect '${name}' (minBuild=${minBuild}) at build 0`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// isOutdated / getMissingFeatures
// ---------------------------------------------------------------------------

describe("isOutdated", () => {
  it("returns false for LATEST_BUILD", () => {
    assert.equal(isOutdated(LATEST_BUILD), false);
  });

  it("returns true for build below LATEST_BUILD", () => {
    assert.equal(isOutdated(LATEST_BUILD - 1), true);
  });

  it("returns false for build above LATEST_BUILD", () => {
    assert.equal(isOutdated(LATEST_BUILD + 1), false);
  });
});

describe("getMissingFeatures", () => {
  it("returns empty array for LATEST_BUILD", () => {
    assert.equal(getMissingFeatures(LATEST_BUILD).length, 0);
  });

  it("returns empty array for a very high build", () => {
    assert.equal(getMissingFeatures(999999).length, 0);
  });

  it("returns features for build 0", () => {
    const missing = getMissingFeatures(0);
    assert.ok(missing.every(f => typeof f.name === "string" && typeof f.description === "string"));
  });
});
