import test from "node:test";
import assert from "node:assert/strict";
import { formatEvolutionDate } from "../lib/research/evolution-date.mjs";

test("evolution dates render identically across host timezones", () => {
  assert.equal(formatEvolutionDate("2026-09-30T07:47:00.000Z"), "Sep 30, 2026, 07:47 AM UTC");
  assert.equal(formatEvolutionDate("2026-09-30T00:00:00.000Z"), "Sep 30, 2026");
});
