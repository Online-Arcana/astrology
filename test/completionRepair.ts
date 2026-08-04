import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readConfig } from "../src/config.js";
import { auditStructured } from "../src/llm/audit/structured.js";
import type { FieldProfile } from "../src/llm/audit/field.js";
import { runInterpretation } from "../src/llm/orchestrate/run.js";
import type {
  InterpretationCall,
  InterpretationRecovery,
  SchemaCall,
  SchemaClient,
  StrictShape,
} from "../src/llm/orchestrate/types.js";
import {
  fallbackCatalogue,
  fallbackCatalogueVersion,
  type FallbackFamily,
} from "../src/llm/reconstruct/catalogue.js";
import { salvagePartialJsonObject } from "../src/llm/reconstruct/partialJson.js";

const shape: StrictShape<{ detail: string }> = {
  name: "completion_repair_fixture",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      detail: { type: "string" },
    },
    required: ["detail"],
  },
};

class Client implements SchemaClient {
  id: string | undefined;

  constructor(
    private readonly onRun: (options: SchemaCall) => object,
  ) {}

  async run<T extends object>(
    _shape: StrictShape<T>,
    _input: unknown,
    options: SchemaCall,
  ): Promise<T> {
    this.id ??= "conv_fixture";
    return this.onRun(options) as T;
  }
}

const config = (debug = false) => readConfig({
  ASTRAL_MAX_RETRIES: "2",
  OPENAI_SMALL_MODEL: "gpt-small-entry",
  OPENAI_SMALL_ESCALATION_MODEL: "gpt-small-escalation",
  OPENAI_BIG_MODEL: "gpt-big-entry",
  OPENAI_BIG_ESCALATION_MODEL: "gpt-big-escalation",
  ASTRAL_DEBUG_THROW_ON_INTERPRETATION_FAILURE: String(debug),
});

const profile = (): FieldProfile => ({
  id: "tropical.house.7",
  lexicon: ["trust", "relationship", "distance", "close"],
  minLength: 2,
  maxLength: 4_000,
});

const unit = (): InterpretationCall => ({
  id: "tropical.house.7",
  label: "House 7",
  kind: "small",
  effort: "none",
  tokens: 256,
  shape,
  allowedSourceRefs: new Set(),
  input: () => ({ field: "house.7" }),
  audit: (value) => auditStructured(value, {}, new Set(), profile()),
});

const xmlText = (value: string): string => value
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&quot;", "\"")
  .replaceAll("&apos;", "'")
  .replaceAll("&amp;", "&");

const xmlCatalogue = (xml: string): Record<string, Record<string, string>> => {
  const output: Record<string, Record<string, string>> = {};
  for (const match of xml.matchAll(/<case id="([^"]+)">([\s\S]*?)<\/case>/gu)) {
    const family = match[1];
    const body = match[2];
    if (family === undefined || body === undefined) continue;
    const fields: Record<string, string> = {};
    for (const field of body.matchAll(/<field name="([^"]+)">([\s\S]*?)<\/field>/gu)) {
      const name = field[1];
      const value = field[2];
      if (name !== undefined && value !== undefined) fields[name] = xmlText(value.trim());
    }
    output[family] = fields;
  }
  return output;
};

test("the XML and runtime fallback catalogues remain identical", async () => {
  const xml = await readFile("src/llm/reconstruct/fallbacks.xml", "utf8");
  assert.match(xml, new RegExp(`schema="${fallbackCatalogueVersion}"`, "u"));
  const parsed = xmlCatalogue(xml);
  const families = Object.keys(fallbackCatalogue) as FallbackFamily[];
  assert.deepEqual(Object.keys(parsed).sort(), [...families].sort());
  for (const family of families) assert.deepEqual(parsed[family], fallbackCatalogue[family]);
});

test("partial JSON salvage preserves only complete top-level fields", () => {
  const salvaged = salvagePartialJsonObject([
    "```json",
    "{\"summary\":\"You communicate directly.\",",
    "\"detail\":\"You prefer explicit expectations, even when a sentence is incomplete",
  ].join("\n"));
  assert.deepEqual(salvaged, {
    summary: "You communicate directly.",
  });

  assert.deepEqual(
    salvagePartialJsonObject("{\"summary\":\"You stay clear, even with commas.\",\"themes\":[\"one\",\"two\"],\"detail\":\"cut"),
    {
      summary: "You stay clear, even with commas.",
      themes: ["one", "two"],
    },
  );
});

test("entry rejection escalates once and audits the escalation output", async () => {
  const models: string[] = [];
  let calls = 0;
  const createClient = (): SchemaClient => new Client((options) => {
    models.push(options.body.model);
    calls += 1;
    return calls === 1
      ? { detail: "Difficulty trusting another person can create distance in close relationships." }
      : { detail: "You may create distance in close relationships when trusting another person feels uncertain." };
  });

  const result = await runInterpretation({}, [unit()], config(), createClient);
  assert.deepEqual(models, ["gpt-small-entry", "gpt-small-escalation"]);
  assert.equal(result.calls, 2);
  assert.equal(result.retries, 1);
  assert.equal(result.units["tropical.house.7"]?.model, "gpt-small-escalation");
  assert.equal(result.units["tropical.house.7"]?.provenance, undefined);
});

test("failed escalation is reconstructed deterministically without a third model call", async () => {
  const models: string[] = [];
  const createClient = (): SchemaClient => new Client((options) => {
    models.push(options.body.model);
    return { detail: "Difficulty trusting another person can create distance in close relationships." };
  });

  const result = await runInterpretation({}, [unit()], config(), createClient);
  const completed = result.units["tropical.house.7"];
  assert.deepEqual(models, ["gpt-small-entry", "gpt-small-escalation"]);
  assert.equal(result.calls, 2);
  assert.equal(result.retries, 1);
  assert.equal(completed?.provenance?.repairedBy, "deterministic");
  assert.equal(completed?.provenance?.repairKind, "deterministic_reconstruction");
  assert.match((completed?.value as { detail: string }).detail, /^You\b/u);
});

test("transport failure on both paid tiers uses XML-backed field fallback", async () => {
  const models: string[] = [];
  const createClient = (): SchemaClient => new Client((options) => {
    models.push(options.body.model);
    throw new Error("transport unavailable");
  });

  const result = await runInterpretation({}, [unit()], config(), createClient);
  const completed = result.units["tropical.house.7"];
  assert.deepEqual(models, ["gpt-small-entry", "gpt-small-escalation"]);
  assert.equal(result.calls, 2);
  assert.equal(completed?.model, "deterministic");
  assert.equal(completed?.provenance?.repairKind, "xml_fallback");
  assert.deepEqual(completed?.provenance?.fallbackFields, ["detail"]);
  assert.match((completed?.value as { detail: string }).detail, /^You\b/u);
});

test("the outer production fallback reconstructs a corrupt recovery checkpoint", async () => {
  const recovery: InterpretationRecovery = {
    conversationId: "conv_corrupt",
    units: {
      "tropical.house.7": {
        id: "tropical.house.7",
        value: { unexpected: "damaged checkpoint" },
        attempts: 0,
        model: "",
      },
    },
    calls: 1,
    retries: 0,
    active: null,
  };
  const createClient = (): SchemaClient => new Client(() => {
    throw new Error("client must not be needed for corrupt recovery fallback");
  });

  const result = await runInterpretation(
    {},
    [unit()],
    config(),
    createClient,
    { onComplete: () => { throw new Error("diagnostic hook failed"); } },
    recovery,
  );
  const completed = result.units["tropical.house.7"];
  assert.equal(completed?.attempts, 1);
  assert.equal(completed?.model, "deterministic");
  assert.equal(completed?.provenance?.repairedBy, "deterministic");
  assert.match((completed?.value as { detail: string }).detail, /^You\b/u);
});

test("throwing is available only through the explicit debug option", async () => {
  const createClient = (): SchemaClient => new Client(() => {
    throw new Error("transport unavailable");
  });
  await assert.rejects(
    () => runInterpretation({}, [unit()], config(true), createClient),
    /required deterministic reconstruction/u,
  );
});
