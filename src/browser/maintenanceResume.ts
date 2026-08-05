import {
  parseCareerInterpretation,
  parseCompatibilityOverview,
  parseFinalSynthesis,
  parseMoneyInterpretation,
  parseRomanticInterpretation,
  parseSexualInterpretation,
  parseSignCompatibility,
  parseStrictSection,
  parseSystemSynthesis,
} from "../chart/parse.js";
import { compatibilityDomains } from "../compat/catalogue.js";
import { generatedNamePattern } from "../file/invariants.js";
import { isAstralFile } from "../file/validate.js";
import type { ChartGenerationCheckpoint } from "../generate/service.js";
import type { UnitResult } from "../llm/orchestrate/types.js";
import type { CompatibilityDomain, Sign } from "../types/astro.js";
import type { PreferredGender } from "../types/base.js";
import type { AstralFile, InterpretationUnit } from "../types/file.js";
import { signs } from "../zodiac/position.js";
import {
  loadOpenAiKey,
  loadSigningKey,
  parseSigningKey,
  validateSigningKey,
  type BrowserSigningKey,
} from "./keys.js";
import { auditOpenedInterpretations } from "./maintenanceAudit.js";
import { BrowserRuntime, browserVersion } from "./runtime.js";

const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const compatibilityDomainSet = new Set<CompatibilityDomain>(compatibilityDomains);

const compatibilityDomain = (value: string | undefined): CompatibilityDomain | null =>
  value !== undefined && compatibilityDomainSet.has(value as CompatibilityDomain)
    ? value as CompatibilityDomain
    : null;

const sign = (value: string | undefined): Sign | null =>
  value !== undefined && signs.includes(value as Sign) ? value as Sign : null;

const sectionValue = (file: AstralFile, unitId: string): unknown => {
  const chart = file["astral-chart"];
  if (unitId === "final-synthesis") return chart.finalSynthesis;
  const prefix = `${chart.zodiac}.`;
  if (!unitId.startsWith(prefix)) return undefined;
  const parts = unitId.slice(prefix.length).split(".");
  const group = parts[0];
  const system = chart.system;

  switch (group) {
    case "overview": return system.overview;
    case "big-three": {
      const key = parts[1];
      if (key === "sun" || key === "moon" || key === "ascendant") return system.bigThree[key];
      return undefined;
    }
    case "life": {
      const key = parts[1];
      return key === undefined ? undefined : (system.life as unknown as Record<string, unknown>)[key];
    }
    case "point": {
      const key = parts[1];
      return key === undefined ? undefined : (system.points as unknown as Record<string, unknown>)[key];
    }
    case "house": {
      const key = parts[1];
      return key === undefined ? undefined : (system.houses as unknown as Record<string, unknown>)[key];
    }
    case "aspect": {
      const id = parts.slice(1).join(".");
      return system.aspects.find((value) => value.id === id)?.section;
    }
    case "pattern": {
      const id = parts.slice(1).join(".");
      return system.patterns.find((value) => value.id === id)?.section;
    }
    case "lunar": {
      const key = parts[1];
      if (key === "phase" || key === "nodes" || key === "lilith") return system.lunar[key];
      return undefined;
    }
    case "eclipse": {
      const key = parts[1];
      if (key === "at-birth") return system.eclipses.atBirth;
      if (key === "prenatal-solar") return system.eclipses.prenatalSolar;
      if (key === "prenatal-lunar") return system.eclipses.prenatalLunar;
      return undefined;
    }
    case "rulership-dignity": return system.rulershipAndDignity;
    case "chart-balance": return system.chartBalance;
    case "dominant-themes": return system.dominantThemes;
    case "synthesis": return system.synthesis;
    case "compatibility": {
      const domain = compatibilityDomain(parts[1]);
      if (domain === null) return undefined;
      const selected = chart.compatibility.domains[domain];
      const target = parts[2];
      if (target === "overview") return { overview: selected.overview, sourceRefs: selected.sourceRefs };
      const selectedSign = sign(target);
      return selectedSign === null ? undefined : selected.signs[selectedSign];
    }
    default: return undefined;
  }
};

const parsedValue = (unitId: string, value: unknown): object => {
  if (unitId === "final-synthesis") return parseFinalSynthesis(value);
  const parts = unitId.split(".");
  const group = parts[1];
  if (group === "synthesis") return parseSystemSynthesis(value);
  if (group === "compatibility") {
    const target = parts[3];
    if (target === "overview") return parseCompatibilityOverview(value);
    const selectedSign = sign(target);
    if (selectedSign === null) throw new TypeError(`Unknown compatibility sign in ${unitId}`);
    return parseSignCompatibility(value, selectedSign);
  }
  if (group === "life") {
    const key = parts[2];
    if (key === "romance") return parseRomanticInterpretation(value);
    if (key === "sexuality") return parseSexualInterpretation(value);
    if (key === "careerAndVocation") return parseCareerInterpretation(value);
    if (key === "moneyAndMaterialSecurity") return parseMoneyInterpretation(value);
  }
  return parseStrictSection(value);
};

const recoveredAttempts = (value: number | undefined): number =>
  value !== undefined && Number.isSafeInteger(value) && value > 0
    ? Math.min(2, value)
    : 1;

const phaseResult = (
  file: AstralFile,
  unit: InterpretationUnit,
): UnitResult<object> => {
  const phase = file["astral-chart"].provenance.phases.find(({ id }) => id === unit.id);
  return {
    id: unit.id,
    value: parsedValue(unit.id, sectionValue(file, unit.id)),
    attempts: recoveredAttempts(phase?.attempts),
    model: phase?.model.trim() || "recovered-chart",
    provenance: {
      migratedFromVersion: file["astral-calculation"].provenance.astralChartsVersion,
    },
  };
};

const safeCount = (value: unknown): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;

const checkpointFor = (file: AstralFile): ChartGenerationCheckpoint => {
  const audit = auditOpenedInterpretations(file);
  const invalid = new Set(audit.invalidUnitIds);
  const units: Record<string, UnitResult<object>> = {};

  for (const unit of file["astral-calculation"].interpretationPlan.units) {
    if (invalid.has(unit.id)) continue;
    units[unit.id] = phaseResult(file, unit);
  }

  const calculation = file["astral-calculation"];
  const generatedName = file["astral-chart"].subject.name.value;
  if (
    calculation.subject.providedName === null
    && !invalid.has("generated-name")
    && generatedNamePattern.test(generatedName)
  ) {
    units["generated-name"] = {
      id: "generated-name",
      value: { value: generatedName },
      attempts: 1,
      model: "recovered-chart",
      provenance: {
        migratedFromVersion: calculation.provenance.astralChartsVersion,
      },
    };
  }

  const provenance = file["astral-chart"].provenance;
  return {
    schema: "astral-generation-recovery/1.1.0",
    version: browserVersion,
    calculationFingerprint: calculation.provenance.calculationFingerprint,
    calculation,
    interpretation: {
      conversationId: null,
      units,
      calls: safeCount(provenance.interpretationCalls),
      retries: safeCount(provenance.retries),
      active: null,
      orchestration: "waves",
      foundationComplete: Object.keys(units).length >= 10,
      snapshot: null,
      wave: null,
    },
  };
};

interface QueuedMaintenance {
  token: symbol;
  checkpoint: ChartGenerationCheckpoint | null;
  signingKey: BrowserSigningKey | null;
}

type GenerateArgs = Parameters<BrowserRuntime["generate"]>;
type GenerateResult = Awaited<ReturnType<BrowserRuntime["generate"]>>;

let queued: QueuedMaintenance | null = null;
const ordinaryGenerate = BrowserRuntime.prototype.generate;

const maintenanceGenerate = async function maintenanceAwareGenerate(
  this: BrowserRuntime,
  birth: GenerateArgs[0],
  options: GenerateArgs[1],
  hooks: GenerateArgs[2],
  signingKey: GenerateArgs[3],
): Promise<GenerateResult> {
  const selected = queued;
  queued = null;
  if (selected === null) return ordinaryGenerate.call(this, birth, options, hooks, signingKey);
  if (selected.checkpoint === null) {
    return ordinaryGenerate.call(this, birth, options, hooks, selected.signingKey);
  }
  return this.resume(selected.checkpoint, hooks, selected.signingKey);
};

BrowserRuntime.prototype.generate = maintenanceGenerate;

const queue = (
  checkpoint: ChartGenerationCheckpoint | null,
  signingKey: BrowserSigningKey | null,
): symbol => {
  const token = Symbol("maintenance-recalculation");
  queued = { token, checkpoint, signingKey };
  return token;
};

const expire = (token: symbol): void => {
  if (queued?.token === token) queued = null;
};

const guardQueuedSubmission = (token: symbol): void => {
  const errorCard = element<HTMLElement>("#errorCard");
  let observer: MutationObserver | null = null;
  const stop = (): void => {
    observer?.disconnect();
    observer = null;
  };
  const inspect = (): void => {
    if (queued?.token !== token) {
      stop();
      return;
    }
    if (errorCard !== null && !errorCard.classList.contains("hidden")) {
      expire(token);
      stop();
    }
  };
  if (errorCard !== null) {
    observer = new MutationObserver(inspect);
    observer.observe(errorCard, { attributes: true, attributeFilter: ["class"] });
  }
  window.setTimeout(() => {
    expire(token);
    stop();
  }, 60_000);
};

const preferredGender = (value: unknown): PreferredGender =>
  value === "female" || value === "non-binary" ? value : "male";

const currentSigningKey = async (): Promise<BrowserSigningKey> => {
  const entered = element<HTMLInputElement>("#signingKey")?.value.trim() ?? "";
  const key = entered.length > 0 ? parseSigningKey(entered) : loadSigningKey();
  if (key === null) throw new Error("Generate, enter or import an Ed25519 signing key first");
  await validateSigningKey(key);
  return key;
};

interface EmbeddedInput {
  current: AstralFile | null;
  subject: Record<string, unknown>;
  birth: Record<string, unknown>;
  place: Record<string, unknown>;
  settings: Record<string, unknown>;
}

const embeddedInput = (raw: unknown): EmbeddedInput => {
  if (!record(raw)) throw new Error("The opened file does not contain a chart object");
  const calculation = raw["astral-calculation"];
  if (!record(calculation)) throw new Error("The opened file has no embedded astral calculation");
  const subject = calculation["subject"];
  const birth = calculation["birth"];
  const place = calculation["place"];
  const settings = calculation["settings"];
  if (!record(subject) || !record(birth) || !record(place) || !record(settings)) {
    throw new Error("The opened file does not contain enough embedded data to recalculate it");
  }
  return {
    current: isAstralFile(raw) ? raw : null,
    subject,
    birth,
    place,
    settings,
  };
};

const stringValue = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${name} is missing`);
  return value.trim();
};

const optionalString = (value: unknown): string => typeof value === "string" ? value : "";

const setSelect = (
  select: HTMLSelectElement,
  label: string,
  value: string,
  item?: object,
): void => {
  const option = new Option(label, value, true, true);
  if (item !== undefined) option.dataset["item"] = JSON.stringify(item);
  select.replaceChildren(option);
  select.disabled = false;
};

const populateMainForm = (input: EmbeddedInput, gender: PreferredGender): void => {
  const providedName = input.subject["providedName"];
  const name = element<HTMLInputElement>("#name");
  const language = element<HTMLInputElement>("#lang");
  const selectedGender = element<HTMLSelectElement>("#preferredGender");
  const date = element<HTMLInputElement>("#date");
  const time = element<HTMLInputElement>("#time");
  const timeAccuracy = element<HTMLSelectElement>("#timeAccuracy");
  const continent = element<HTMLSelectElement>("#continent");
  const country = element<HTMLSelectElement>("#country");
  const regionSelect = element<HTMLSelectElement>("#region");
  const cityQuery = element<HTMLInputElement>("#cityQuery");
  const city = element<HTMLSelectElement>("#city");
  const zodiac = element<HTMLSelectElement>("#zodiac");
  const ayanamsha = element<HTMLSelectElement>("#ayanamsha");
  const selectedPlace = element<HTMLElement>("#selectedPlace");
  if (
    name === null || language === null || selectedGender === null || date === null
    || time === null || timeAccuracy === null || continent === null || country === null
    || regionSelect === null || cityQuery === null || city === null || zodiac === null
    || ayanamsha === null || selectedPlace === null
  ) {
    throw new Error("The main chart form is incomplete");
  }

  const placeId = stringValue(input.place["id"], "Embedded place ID");
  const continentName = stringValue(input.place["continent"], "Embedded continent");
  const subcontinent = typeof input.place["subcontinent"] === "string"
    ? input.place["subcontinent"]
    : null;
  const cityValue = input.place["city"];
  const countryValue = input.place["country"];
  const regionValue = input.place["region"];
  if (!record(cityValue) || !record(countryValue)) throw new Error("Embedded place details are incomplete");
  const cityName = stringValue(cityValue["name"], "Embedded city name");
  const countryCode = stringValue(countryValue["code"], "Embedded country code");
  const countryName = stringValue(countryValue["name"], "Embedded country name");
  const region = record(regionValue)
    ? {
        code: optionalString(regionValue["code"]),
        name: stringValue(regionValue["name"], "Embedded region name"),
      }
    : null;
  const latitude = Number(input.place["latitude"]);
  const longitude = Number(input.place["longitude"]);
  const timeZone = stringValue(input.place["timeZone"], "Embedded timezone");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Embedded place coordinates are invalid");
  }

  name.value = typeof providedName === "string" ? providedName : "";
  language.value = optionalString(input.subject["language"]) || "en-GB";
  selectedGender.value = gender;
  date.value = stringValue(input.birth["date"], "Embedded birth date");
  const accuracy = input.birth["timeAccuracy"];
  timeAccuracy.value = accuracy === "approximate" || accuracy === "unknown" ? accuracy : "exact";
  time.value = timeAccuracy.value === "unknown" ? "" : optionalString(input.birth["time"]);
  time.disabled = timeAccuracy.value === "unknown";
  time.required = timeAccuracy.value !== "unknown";

  setSelect(continent, continentName, continentName);
  setSelect(country, `${countryName} (${countryCode})`, countryCode, {
    code: countryCode,
    name: countryName,
    continent: continentName,
    subcontinent,
  });
  if (region === null) {
    regionSelect.replaceChildren(new Option("Search the whole country", "", true, true));
    regionSelect.disabled = false;
  } else {
    setSelect(regionSelect, region.name, region.code, region);
  }
  cityQuery.value = cityName;
  setSelect(city, cityName, placeId, {
    id: placeId,
    name: cityName,
    region,
    latitude,
    longitude,
    timeZone,
  });
  selectedPlace.textContent = `${cityName}${region === null ? "" : `, ${region.name}`} · ${latitude.toFixed(4)}, ${longitude.toFixed(4)} · ${timeZone}`;

  const selectedZodiac = input.settings["primaryZodiac"] === "sidereal" ? "sidereal" : "tropical";
  zodiac.value = selectedZodiac;
  const selectedAyanamsha = input.settings["siderealAyanamsha"];
  ayanamsha.value = selectedAyanamsha === "fagan_bradley"
    || selectedAyanamsha === "krishnamurti"
    || selectedAyanamsha === "raman"
    ? selectedAyanamsha
    : "lahiri";
  ayanamsha.disabled = selectedZodiac !== "sidereal";
};

const setStatus = (message: string, warning = false): void => {
  const status = element<HTMLElement>("#canonicaliseStatus");
  if (status === null) return;
  status.textContent = message;
  status.className = warning
    ? "notice warning canonicalise-analysis"
    : "canonicalise-analysis";
};

const navigateAndSubmit = (): void => {
  element<HTMLButtonElement>('.tab[data-panel="createPanel"]')?.click();
  const form = element<HTMLFormElement>("#chartForm");
  const submitter = element<HTMLButtonElement>("#generateButton");
  if (form === null || submitter === null) throw new Error("The main chart generator is unavailable");
  if (!form.reportValidity()) throw new Error("The embedded chart data could not populate every required generation field");
  form.requestSubmit(submitter);

  const reveal = (attempt = 0): void => {
    const progress = element<HTMLElement>("#progressCard");
    if (progress !== null && !progress.classList.contains("hidden")) {
      progress.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (attempt < 100) setTimeout(() => reveal(attempt + 1), 25);
  };
  reveal();
};

const remainingUnits = (
  file: AstralFile,
  checkpoint: ChartGenerationCheckpoint,
): number => {
  const total = file["astral-calculation"].interpretationPlan.units.length
    + (file["astral-calculation"].subject.providedName === null ? 1 : 0);
  return Math.max(0, total - Object.keys(checkpoint.interpretation.units).length);
};

const startMaintenanceRecalculation = async (): Promise<void> => {
  const file = element<HTMLInputElement>("#astralFile")?.files?.[0];
  if (file === undefined) throw new Error("Open an .astral file first");
  if (loadOpenAiKey().length === 0) {
    throw new Error("Enter and save, or unlock, the OpenAI API key before recalculating this chart");
  }

  const raw: unknown = JSON.parse(await file.text());
  const embedded = embeddedInput(raw);
  const gender = preferredGender(element<HTMLSelectElement>("#canonicaliseGender")?.value);
  const signOutput = element<HTMLInputElement>("#canonicaliseSign")?.checked === true;
  const key = signOutput ? await currentSigningKey() : null;
  populateMainForm(embedded, gender);

  const existingGender = preferredGender(embedded.subject["preferredGender"]);
  const sameInterpretationBasis = embedded.current !== null && existingGender === gender;
  const checkpoint = sameInterpretationBasis ? checkpointFor(embedded.current as AstralFile) : null;
  const remaining = checkpoint === null || embedded.current === null
    ? null
    : remainingUnits(embedded.current, checkpoint);

  setStatus(checkpoint === null
    ? "Opening the full generation screen. The interpretation basis changed or the file is legacy, so every required interpretation will be rebuilt with live ETA, stages, lanes and cost."
    : `Opening the full generation screen. ${remaining ?? 0} missing or invalid interpretation unit${remaining === 1 ? "" : "s"} will be rebuilt; valid units remain accepted.`);

  const token = queue(checkpoint, key);
  try {
    guardQueuedSubmission(token);
    navigateAndSubmit();
  } catch (cause: unknown) {
    expire(token);
    throw cause;
  }
};

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLButtonElement>("#canonicaliseRun")
    : null;
  if (target === null) return;
  const selected = element<HTMLInputElement>("#canonicaliseComplete")?.checked === true;
  if (!selected) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  target.disabled = true;
  void startMaintenanceRecalculation()
    .catch((cause: unknown) => {
      setStatus(cause instanceof Error ? cause.message : String(cause), true);
    })
    .finally(() => {
      target.disabled = false;
    });
}, true);
