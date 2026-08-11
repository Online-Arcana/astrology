import { CalculationService, loadCalculationPorts, type CalculationOptions } from "../calculate/service.js";
import { assembleChart } from "../chart/assemble.js";
import { assembleAstralFile } from "../file/document.js";
import { encodeAstralFile } from "../file/validate.js";
import { shapeForUnit } from "../llm/schema/chart.js";
import type { Schema } from "../llm/schema/build.js";
import type { InterpretationRun, UnitResult } from "../llm/orchestrate/types.js";
import { loadCscCatalogue } from "../place/csc.js";
import type { PlaceCatalogue } from "../place/model.js";
import { refsValid } from "../ref/resolve.js";
import type { BirthInput, JsonRef } from "../types/base.js";
import type { AstralCalculation, InterpretationUnit } from "../types/file.js";
import {
  testArtifactMarker,
  testArtifactStatus,
} from "../testing/artifact.js";
import {
  generateTestSigningKey,
  isTestSigningKey,
  loadSigningKey,
  signingKeyId,
  validateSigningKey,
  type BrowserSigningKey,
} from "./keys.js";

const browserVersion = "0.20.0";
const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
const testModel = "TEST-ONLY/LOREM-IPSUM/NO-LLM";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

const randomIndex = (length: number): number => Math.floor(Math.random() * length);
const randomItem = <T>(values: readonly T[]): T | null => values.length === 0 ? null : values[randomIndex(values.length)] ?? null;
const pad = (value: number): string => String(value).padStart(2, "0");

const randomDate = (): string => {
  const first = Date.UTC(1950, 0, 1);
  const last = Date.UTC(2049, 11, 31);
  const day = 86_400_000;
  const days = Math.floor((last - first) / day);
  return new Date(first + randomIndex(days + 1) * day).toISOString().slice(0, 10);
};

const randomTime = (): string => `${pad(randomIndex(24))}:${pad(randomIndex(60))}`;

const optionsFromUi = (): CalculationOptions => {
  const zodiacValue = element<HTMLSelectElement>("#zodiac")?.value;
  const zodiac = zodiacValue === "sidereal" ? "sidereal" : "tropical";
  const ayanamshaValue = element<HTMLSelectElement>("#ayanamsha")?.value;
  const ayanamsha = ayanamshaValue === "fagan_bradley" || ayanamshaValue === "krishnamurti" || ayanamshaValue === "raman"
    ? ayanamshaValue
    : "lahiri";
  return { primaryZodiac: zodiac, interpretationMode: zodiac, ayanamsha };
};

const chooseRandomPlace = async (catalogue: PlaceCatalogue): Promise<string> => {
  const countries = await catalogue.countries();
  if (countries.length === 0) throw new Error("The place catalogue contains no countries");

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const country = randomItem(countries);
    if (country === null) continue;
    const regions = await catalogue.regions(country.code);
    const region = randomItem(regions);
    const cities = await catalogue.cities(country.code, region?.code ?? null, "");
    const usable = cities.filter((city) => city.timeZone.length > 0 && Number.isFinite(city.latitude) && Number.isFinite(city.longitude));
    const city = randomItem(usable);
    if (city !== null) return city.id;
  }
  throw new Error("Could not find a random city with usable timezone data");
};

const calculateRandom = async (): Promise<AstralCalculation> => {
  const [ports, catalogue] = await Promise.all([
    loadCalculationPorts(browserVersion),
    loadCscCatalogue(),
  ]);
  const service = new CalculationService(ports);
  const placeId = await chooseRandomPlace(catalogue);
  const options = optionsFromUi();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const birth: BirthInput = {
      date: randomDate(),
      time: randomTime(),
      timeAccuracy: "exact",
      placeId,
      name: "TEST Random Canonical Chart",
      lang: "en-GB",
      preferredGender: "non-binary",
    };
    try {
      const calculation = await service.calculate(birth, options);
      const ascendant = calculation.system.points.ascendant.position.value;
      const midheaven = calculation.system.points.midheaven.position.value;
      if (ascendant !== null && midheaven !== null) return calculation;
      lastError = new Error("Random time did not produce complete timed chart geometry");
    } catch (cause: unknown) {
      lastError = cause;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not produce a complete random exact-time chart");
};

const validRefs = (calculation: AstralCalculation, unit: InterpretationUnit): JsonRef[] => {
  const root = { "astral-calculation": calculation };
  return unit.allowedSourceRefs.filter((ref) => refsValid(root, [ref], new Set([ref])));
};

const schemaValue = (schema: Schema, key: string, refs: readonly JsonRef[]): unknown => {
  if (typeof schema["const"] === "string") return schema["const"];
  const permitted = schema["enum"];
  if (Array.isArray(permitted) && permitted.length > 0) return permitted[0];
  const variants = schema["anyOf"];
  if (Array.isArray(variants)) {
    const selected = variants.find((variant) => typeof variant === "object" && variant !== null && (variant as Schema)["type"] !== "null");
    return selected === undefined ? null : schemaValue(selected as Schema, key, refs);
  }

  switch (schema["type"]) {
    case "object": {
      const properties = schema["properties"];
      if (typeof properties !== "object" || properties === null || Array.isArray(properties)) return {};
      return Object.fromEntries(Object.entries(properties as Record<string, Schema>)
        .map(([child, childSchema]) => [child, schemaValue(childSchema, child, refs)]));
    }
    case "array": {
      if (key === "sourceRefs") return refs.length === 0 ? [] : [refs[0]];
      const items = typeof schema["items"] === "object" && schema["items"] !== null
        ? schema["items"] as Schema
        : { type: "string" } satisfies Schema;
      return [schemaValue(items, key, refs)];
    }
    case "string": return key === "title" ? "Lorem Ipsum — TEST placeholder" : lorem;
    case "number":
    case "integer": return 0;
    case "boolean": return false;
    case "null": return null;
    default: return lorem;
  }
};

const loremRun = (calculation: AstralCalculation): InterpretationRun => {
  const units: Record<string, UnitResult<object>> = {};
  for (const unit of calculation.interpretationPlan.units) {
    const refs = validRefs(calculation, unit);
    const shape = shapeForUnit(unit, refs);
    const raw = schemaValue(shape.schema, unit.id, refs);
    const value = shape.parse === undefined ? raw : shape.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`TEST placeholder for ${unit.id} did not produce an object`);
    }
    units[unit.id] = { id: unit.id, value, attempts: 1, model: testModel };
  }
  return {
    conversationId: "TEST-ONLY-NO-LLM",
    units,
    calls: 0,
    retries: 0,
    orchestration: "waves",
    conversationIds: [],
    snapshotRevision: 0,
    waves: 0,
  };
};

const signingKeyForTest = async (): Promise<{ key: BrowserSigningKey; mode: "test_key" | "existing_key" }> => {
  const existing = loadSigningKey();
  if (existing !== null && !isTestSigningKey(existing)) {
    await validateSigningKey(existing);
    return { key: existing, mode: "existing_key" };
  }
  const key = await generateTestSigningKey();
  await validateSigningKey(key, true);
  return { key, mode: "test_key" };
};

const buildTestFile = async () => {
  const calculation = await calculateRandom();
  const run = loremRun(calculation);
  const generatedAt = new Date().toISOString();
  const chart = assembleChart(calculation, run, {
    generatedAt,
    bigModel: testModel,
    smallModel: testModel,
    structuredOutputSchema: "TEST-ONLY/LOREM-IPSUM",
    promptCatalogue: "TEST-ONLY/NO-PROMPTS",
    astrologyCatalogue: calculation.provenance.astrologyProfile,
    nlpAuditProfile: "TEST-ONLY/NO-NLP-AUDIT",
  });
  const { key, mode } = await signingKeyForTest();
  const keyId = await signingKeyId(key);
  const nonce = crypto.randomUUID();
  const markedChart = {
    ...chart,
    provenance: {
      ...chart.provenance,
      testArtifact: testArtifactMarker(mode, keyId, nonce),
    },
  };
  const file = await assembleAstralFile(calculation, markedChart, {
    issuer: key.issuer,
    keys: key,
    generatedAt,
  });
  const status = await testArtifactStatus(file);
  const expected = mode === "test_key" ? "verified_test_key" : "verified_existing_key";
  if (status !== expected) throw new Error(`Generated TEST chart failed its own signature audit: ${status}`);
  return { file, calculation, mode };
};

const activateOpenPanel = (): void => {
  for (const panel of document.querySelectorAll<HTMLElement>(".panel")) panel.classList.toggle("active", panel.id === "openPanel");
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".tab")) tab.classList.toggle("active", tab.dataset["panel"] === "openPanel");
};

const selectWheelWhenReady = (attempt = 0): void => {
  const tab = document.querySelector<HTMLButtonElement>('.subtab[data-view="wheelView"]');
  if (tab !== null) {
    tab.click();
    return;
  }
  if (attempt < 80) setTimeout(() => selectWheelWhenReady(attempt + 1), 25);
};

const loadIntoViewer = (source: string): void => {
  const input = element<HTMLInputElement>("#astralFile");
  if (input === null) throw new Error("The .astral file input is unavailable");
  const transfer = new DataTransfer();
  transfer.items.add(new File([source], "TEST-RANDOM-CANONICAL.astral", { type: "application/json" }));
  input.files = transfer.files;
  activateOpenPanel();
  input.dispatchEvent(new Event("change", { bubbles: true }));
  selectWheelWhenReady();
};

const install = (): void => {
  const form = element<HTMLFormElement>("#chartForm");
  const actions = form?.querySelector<HTMLElement>(":scope > .actions") ?? null;
  if (form === null || actions === null || element("#randomCanonicalTestChart") !== null) return;

  const button = document.createElement("button");
  button.id = "randomCanonicalTestChart";
  button.type = "button";
  button.className = "secondary";
  button.textContent = "TEST: Random canonical chart (no LLM)";
  const status = document.createElement("p");
  status.id = "randomCanonicalTestStatus";
  status.className = "selected-place";
  status.textContent = "Generates real deterministic astrology with Lorem Ipsum interpretation placeholders.";
  actions.append(button);
  actions.insertAdjacentElement("afterend", status);

  button.addEventListener("click", () => void (async () => {
    button.disabled = true;
    status.textContent = "Generating random place, exact date/time and deterministic chart…";
    const generated = await buildTestFile();
    const source = encodeAstralFile(generated.file, true);
    status.textContent = `${generated.calculation.birth.date} ${generated.calculation.birth.time ?? ""} · ${generated.calculation.place.city.name}, ${generated.calculation.place.country.name} · ${generated.mode === "test_key" ? "ephemeral TEST-ONLY signature; public test package mode" : "current real browser signature; normal package security remains enabled"}.`;
    loadIntoViewer(source);
  })().catch((cause: unknown) => {
    status.textContent = cause instanceof Error ? cause.message : String(cause);
  }).finally(() => {
    button.disabled = false;
  }));
};

install();
