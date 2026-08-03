import assert from "node:assert/strict";
import test from "node:test";
import { coherenceIssues } from "../src/llm/orchestrate/coherence.js";
import type { UnitResult } from "../src/llm/orchestrate/types.js";

const unit = (id: string, detail: string): UnitResult<object> => ({
  id,
  value: { detail },
  attempts: 1,
  model: "fixture",
});

test("different chart units may describe opposite context-dependent behaviour", () => {
  const units = {
    "tropical.point.saturn": unit(
      "tropical.point.saturn",
      "You can appear cold, restrained and self-contained with unfamiliar people while trust is still being established.",
    ),
    "tropical.house.11": unit(
      "tropical.house.11",
      "You are warm, affectionate and openly supportive with the close friends who belong to your trusted inner circle.",
    ),
  };

  assert.deepEqual(coherenceIssues(units, "wave"), []);
});
