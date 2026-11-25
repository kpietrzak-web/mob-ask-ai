/**
 * Unit tests for filterDefinitions.ts
 *
 * Run with:  npx tsx --test filterDefinitions.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FILTER_DEFINITIONS,
  getFilterDefinition,
  buildFilterDescription,
} from "./filterDefinitions";

describe("FILTER_DEFINITIONS", () => {
  it("contains a definition for filters_incomes_list", () => {
    const def = FILTER_DEFINITIONS.find((d) => d.screen === "filters_incomes_list");
    assert.ok(def, "Expected filters_incomes_list definition");
  });

  it("contains a definition for filters_expenses_list", () => {
    const def = FILTER_DEFINITIONS.find((d) => d.screen === "filters_expenses_list");
    assert.ok(def, "Expected filters_expenses_list definition");
  });

  it("each definition has at least one field", () => {
    for (const def of FILTER_DEFINITIONS) {
      assert.ok(def.fields.length > 0, `${def.screen} should have at least one field`);
    }
  });

  it("each field has a key, label, and type", () => {
    for (const def of FILTER_DEFINITIONS) {
      for (const field of def.fields) {
        assert.ok(field.key, `Missing key in ${def.screen}`);
        assert.ok(field.label, `Missing label for ${field.key} in ${def.screen}`);
        assert.ok(field.type, `Missing type for ${field.key} in ${def.screen}`);
      }
    }
  });

  it("enum fields have enumValues", () => {
    for (const def of FILTER_DEFINITIONS) {
      for (const field of def.fields) {
        if (field.type === "enum") {
          assert.ok(
            Array.isArray(field.enumValues) && field.enumValues.length > 0,
            `Enum field ${field.key} in ${def.screen} must have enumValues`
          );
        }
      }
    }
  });
});

describe("getFilterDefinition", () => {
  it("returns the correct definition for a known screen", () => {
    const def = getFilterDefinition("filters_incomes_list");
    assert.ok(def);
    assert.equal(def.screen, "filters_incomes_list");
  });

  it("returns null for an unknown screen", () => {
    assert.equal(getFilterDefinition("unknown_screen"), null);
  });

  it("returns null for empty string", () => {
    assert.equal(getFilterDefinition(""), null);
  });
});

describe("buildFilterDescription", () => {
  it("produces a non-empty string for a known definition", () => {
    const def = getFilterDefinition("filters_incomes_list");
    assert.ok(def);
    const desc = buildFilterDescription(def);
    assert.ok(desc.length > 20, "Description should be non-trivial");
  });

  it("includes filter field keys in the description", () => {
    const def = getFilterDefinition("filters_incomes_list");
    assert.ok(def);
    const desc = buildFilterDescription(def);
    assert.ok(desc.includes("issueDateFrom"), "Should mention issueDateFrom");
    assert.ok(desc.includes("grossMin"), "Should mention grossMin");
  });

  it("includes enum values in description for enum fields", () => {
    const def = getFilterDefinition("filters_incomes_list");
    assert.ok(def);
    const desc = buildFilterDescription(def);
    assert.ok(desc.includes("issued"), "Should mention issued status");
  });
});

describe("set_filters version gating", () => {
  it("set_filters is not available at version 1.50.0", async () => {
    const { getAvailableActions } = await import("./actionVersioning");
    const actions = getAvailableActions("1.50.0");
    assert.equal(actions.has("set_filters"), false, "set_filters should not be available at 1.50.0");
  });

  it("set_filters is available at version 1.51.0", async () => {
    const { getAvailableActions } = await import("./actionVersioning");
    const actions = getAvailableActions("1.51.0");
    assert.equal(actions.has("set_filters"), true, "set_filters should be available at 1.51.0");
  });

  it("set_filters is available at version 2.0.0", async () => {
    const { getAvailableActions } = await import("./actionVersioning");
    const actions = getAvailableActions("2.0.0");
    assert.equal(actions.has("set_filters"), true, "set_filters should be available at 2.0.0");
  });
});
