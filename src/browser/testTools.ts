import type { CalculationOptions } from "../calculate/service.js";
import { assembleAstralFile } from "../file/document.js";
import {
  encodeAstralFile,
  isAstralFile,
  validateAstralFile,
} from "../file/validate.js";
import type { BirthInput, PreferredGender } from "../types/base.js";
import type { AstralFile, AstralValidation } from "../types/file.js";
import {
  loadSigningKey,
  parseSigningKey,
  saveOpenAiKey,
  validateSigningKey,
  type BrowserSigningKey,
} from "./keys.js";
import { BrowserRuntime } from "./runtime.js";

const openAiStorageKey = "astral.openai-key";
const signingStorageKey = "astral.signing-key";
const svgNamespace = "http://www.w3.org/2000/svg";

type RecordValue = Record<string, unknown>;

interface EmbeddedRequest {
  birth: BirthInput;
  options: CalculationOptions;
  existingGender: PreferredGender | null;
}

interface MaintenanceState {
  raw: unknown;
  fileName: string;
  current: AstralFile | null;
  validation: AstralValidation | null;
  request: EmbeddedRequest | null;
}

interface ViewerReading {
  title: string;
  technical: boolean;
  body: HTMLElement;
}

interface ViewerCategory {
  id: string;
  title: string;
  readings: ViewerReading[];
}

const record = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const element = <T extends Element>(selector: string): T | null =>
  document.querySelector<T>(selector);

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const preferredGender = (value: unknown): PreferredGender | null =>
  value === "male" || value === "female" || value === "non-binary" ? value : null;

const zodiac = (value: unknown): CalculationOptions["primaryZodiac"] | null =>
  value === "tropical" || value === "sidereal" ? value : null;

const ayanamsha = (value: unknown): CalculationOptions["ayanamsha"] | null =>
  value === "lahiri" || value === "fagan_bradley" || value === "krishnamurti" || value === "raman"
    ? value
    : null;

const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(value);
    return;
  }
  const temporary = document.createElement("textarea");
  temporary.value = value;
  temporary.readOnly = true;
  temporary.style.position = "fixed";
  temporary.style.opacity = "0";
  document.body.append(temporary);
  temporary.select();
  const copied = document.execCommand("copy");
  temporary.remove();
  if (!copied) throw new Error("The browser did not allow clipboard access");
};

const downloadText = (name: string, value: string, type = "text/plain;charset=utf-8"): void => {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const safeName = (value: string): string => value
  .replaceAll(/[^A-Za-z0-9._-]+/gu, "-")
  .replaceAll(/^-+|-+$/gu, "") || "astral";

const icon = (kind: "open" | "closed"): SVGSVGElement => {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = kind === "open"
    ? '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle>'
    : '<path d="m3 3 18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-2 3.1"></path><path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8a10.7 10.7 0 0 0 5.4-1.4"></path>';
  return svg;
};

const actionButton = (id: string, label: string): HTMLButtonElement => {
  const value = document.createElement("button");
  value.id = id;
  value.type = "button";
  value.className = "ghost";
  value.textContent = label;
  return value;
};

const statusLine = (id: string, text: string): HTMLParagraphElement => {
  const value = document.createElement("p");
  value.id = id;
  value.className = "muted tool-status";
  value.textContent = text;
  return value;
};

const setStatus = (target: HTMLElement, message: string, warning = false): void => {
  target.textContent = message;
  target.className = warning ? "notice warning tool-status" : "muted tool-status";
};

const enhanceOpenAiKey = (): void => {
  const source = element<HTMLInputElement>("#openAiKey");
  if (source === null || element("#copyOpenAiKey") !== null) return;
  const primary = source.closest<HTMLElement>(".credential-primary");
  const credential = source.closest<HTMLElement>(".credential-openai");
  if (primary === null || credential === null) return;

  const field = document.createElement("span");
  field.className = "password-field tool-password-field";
  source.before(field);
  field.append(source);

  const toggle = document.createElement("button");
  toggle.id = "showOpenAiKey";
  toggle.type = "button";
  toggle.className = "password-toggle";
  const open = icon("open");
  const closed = icon("closed");
  toggle.replaceChildren(closed, open);
  field.append(toggle);

  const syncVisibility = (): void => {
    const visible = source.type === "text";
    open.style.display = visible ? "" : "none";
    closed.style.display = visible ? "none" : "";
    toggle.setAttribute("aria-pressed", String(visible));
    toggle.setAttribute("aria-label", visible ? "Hide OpenAI API key" : "Show OpenAI API key");
    toggle.title = visible ? "Hide OpenAI API key" : "Show OpenAI API key";
  };
  syncVisibility();
  toggle.addEventListener("click", () => {
    source.type = source.type === "text" ? "password" : "text";
    syncVisibility();
  });

  const actions = document.createElement("div");
  actions.className = "actions credential-backup-actions";
  const copy = actionButton("copyOpenAiKey", "Copy key");
  const save = actionButton("downloadOpenAiKey", "Download key");
  const importButton = actionButton("importOpenAiKey", "Import key");
  const importInput = document.createElement("input");
  importInput.id = "openAiKeyFile";
  importInput.type = "file";
  importInput.accept = ".txt,.key,.json,text/plain,application/json";
  importInput.hidden = true;
  actions.append(copy, save, importButton, importInput);
  const status = statusLine("openAiKeyToolStatus", "The key remains local to this browser unless you explicitly copy or export it.");
  credential.append(actions, status);

  const selected = (): string => {
    const value = source.value.trim() || localStorage.getItem(openAiStorageKey)?.trim() || "";
    if (value.length === 0) throw new Error("Enter or import an OpenAI API key first");
    return value;
  };

  copy.addEventListener("click", () => void copyText(selected())
    .then(() => setStatus(status, "OpenAI API key copied."))
    .catch((cause: unknown) => setStatus(status, cause instanceof Error ? cause.message : String(cause), true)));
  save.addEventListener("click", () => {
    try {
      downloadText("openai-api-key.txt", `${selected()}\n`);
      setStatus(status, "OpenAI API key downloaded. Keep the file private.");
    } catch (cause: unknown) {
      setStatus(status, cause instanceof Error ? cause.message : String(cause), true);
    }
  });
  importButton.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", () => void (async () => {
    const file = importInput.files?.[0];
    if (file === undefined) return;
    const raw = (await file.text()).trim();
    let value = raw;
    if (raw.startsWith("{")) {
      const parsed: unknown = JSON.parse(raw);
      if (!record(parsed)) throw new Error("The API key file must contain text or a JSON object");
      value = stringValue(parsed["apiKey"]) ?? stringValue(parsed["key"]) ?? "";
    }
    if (value.length === 0) throw new Error("The imported file does not contain an API key");
    source.value = value;
    saveOpenAiKey(value);
    importInput.value = "";
    setStatus(status, "OpenAI API key imported and saved locally.");
  })().catch((cause: unknown) => setStatus(status, cause instanceof Error ? cause.message : String(cause), true)));
};

const enhanceSigningKey = (): void => {
  const source = element<HTMLInputElement>("#signingKey");
  if (source === null || element("#signingKeyFields") !== null) return;
  const primary = source.closest<HTMLElement>(".credential-primary");
  const credential = source.closest<HTMLElement>(".credential-signing");
  if (primary === null || credential === null) return;

  const originalField = source.closest<HTMLElement>(".password-field") ?? source;
  originalField.classList.add("tool-hidden-source");
  originalField.setAttribute("aria-hidden", "true");

  const fields = document.createElement("div");
  fields.id = "signingKeyFields";
  fields.className = "signing-key-fields";

  const makeField = (id: string, label: string, secret: boolean): HTMLLabelElement => {
    const wrapper = document.createElement("label");
    wrapper.className = "signing-key-field";
    wrapper.textContent = label;
    const value = document.createElement("input");
    value.id = id;
    value.type = secret ? "password" : "text";
    value.autocomplete = "off";
    value.spellcheck = false;
    value.readOnly = secret;
    wrapper.append(value);
    return wrapper;
  };

  fields.append(
    makeField("signingIssuer", "Issuer", false),
    makeField("signingPrivatePkcs8", "Private PKCS8", true),
    makeField("signingPublicRaw", "Public raw key", true),
  );

  const reveal = document.createElement("button");
  reveal.id = "showSigningKeyFields";
  reveal.type = "button";
  reveal.className = "password-toggle signing-fields-toggle";
  const open = icon("open");
  const closed = icon("closed");
  reveal.replaceChildren(closed, open);
  fields.append(reveal);
  primary.prepend(fields);

  const issuer = element<HTMLInputElement>("#signingIssuer");
  const privateKey = element<HTMLInputElement>("#signingPrivatePkcs8");
  const publicKey = element<HTMLInputElement>("#signingPublicRaw");
  if (issuer === null || privateKey === null || publicKey === null) return;

  let visible = false;
  const syncVisibility = (): void => {
    privateKey.type = visible ? "text" : "password";
    publicKey.type = visible ? "text" : "password";
    privateKey.readOnly = !visible;
    publicKey.readOnly = !visible;
    open.style.display = visible ? "" : "none";
    closed.style.display = visible ? "none" : "";
    reveal.setAttribute("aria-pressed", String(visible));
    reveal.setAttribute("aria-label", visible ? "Hide and lock signing key fields" : "Show and edit signing key fields");
    reveal.title = visible ? "Hide and lock signing key fields" : "Show and edit signing key fields";
  };
  syncVisibility();
  reveal.addEventListener("click", () => {
    visible = !visible;
    syncVisibility();
  });

  const syncSource = (): void => {
    source.value = JSON.stringify({
      issuer: issuer.value.trim(),
      privatePkcs8: privateKey.value.trim(),
      publicRaw: publicKey.value.trim(),
    }, null, 2);
  };
  const syncFields = (): void => {
    const selected = source.value.trim() || localStorage.getItem(signingStorageKey)?.trim() || "";
    if (selected.length === 0) {
      issuer.value = "";
      privateKey.value = "";
      publicKey.value = "";
      return;
    }
    try {
      const parsed = parseSigningKey(selected);
      issuer.value = parsed.issuer;
      privateKey.value = parsed.privatePkcs8;
      publicKey.value = parsed.publicRaw;
    } catch {
      // The original validator reports malformed imported bundles.
    }
  };
  for (const value of [issuer, privateKey, publicKey]) {
    value.addEventListener("input", syncSource);
    value.addEventListener("change", syncSource);
  }
  syncFields();

  const existingActions = element<HTMLElement>("#copySigningKeyBundle")?.closest<HTMLElement>(".signing-key-actions") ?? null;
  const existingStatus = element<HTMLElement>("#signingKeyExportStatus");
  if (existingActions !== null) credential.append(existingActions);
  if (existingStatus !== null) credential.append(existingStatus);

  const refreshAfter = (selector: string): void => {
    const control = element<HTMLButtonElement>(selector);
    if (control === null) return;
    control.addEventListener("click", () => {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        syncFields();
        if (attempts >= 30) clearInterval(timer);
      }, 100);
    });
  };
  refreshAfter("#saveSigningKey");
  refreshAfter("#generateSigningKey");
  refreshAfter("#importSigningKeyBundle");
  const clear = element<HTMLButtonElement>("#clearSigningKey");
  clear?.addEventListener("click", () => setTimeout(syncFields, 0));
};

const extraction = (raw: unknown): EmbeddedRequest | null => {
  if (!record(raw)) return null;
  const calculation = raw["astral-calculation"];
  if (!record(calculation)) return null;
  const birth = calculation["birth"];
  const place = calculation["place"];
  const subject = calculation["subject"];
  if (!record(birth) || !record(place) || !record(subject)) return null;

  const date = stringValue(birth["date"]);
  const placeId = stringValue(place["id"]);
  if (date === null || placeId === null) return null;
  const timeRaw = birth["time"];
  const time = typeof timeRaw === "string" ? timeRaw : null;
  const accuracyRaw = birth["timeAccuracy"];
  const timeAccuracy: BirthInput["timeAccuracy"] = accuracyRaw === "approximate" || accuracyRaw === "unknown"
    ? accuracyRaw
    : "exact";

  const settings = record(calculation["settings"]) ? calculation["settings"] : {};
  const system = record(calculation["system"]) ? calculation["system"] : {};
  const primary = zodiac(settings["primaryZodiac"])
    ?? zodiac(settings["interpretationMode"])
    ?? zodiac(system["zodiac"])
    ?? "tropical";
  const selectedAyanamsha = ayanamsha(settings["siderealAyanamsha"])
    ?? ayanamsha(system["ayanamsha"])
    ?? "lahiri";

  const input: BirthInput = {
    date,
    time: timeAccuracy === "unknown" ? null : time,
    timeAccuracy,
    placeId,
  };
  const name = stringValue(subject["providedName"]);
  const language = stringValue(subject["language"]);
  const gender = preferredGender(subject["preferredGender"]);
  if (name !== null) input.name = name;
  if (language !== null) input.lang = language;
  if (gender !== null) input.preferredGender = gender;

  return {
    birth: input,
    options: {
      primaryZodiac: primary,
      interpretationMode: primary,
      ayanamsha: selectedAyanamsha,
    },
    existingGender: gender,
  };
};

let maintenance: MaintenanceState | null = null;

const maintenanceCard = (): HTMLElement | null => element<HTMLElement>("#canonicaliseCard");
const maintenanceStatus = (): HTMLElement | null => element<HTMLElement>("#canonicaliseStatus");

const selectedMaintenanceGender = (): PreferredGender => {
  const value = element<HTMLSelectElement>("#canonicaliseGender")?.value;
  return preferredGender(value) ?? "male";
};

const selectedSigningKey = async (): Promise<BrowserSigningKey> => {
  const source = element<HTMLInputElement>("#signingKey");
  const raw = source?.value.trim() || localStorage.getItem(signingStorageKey)?.trim() || "";
  const key = raw.length > 0 ? parseSigningKey(raw) : loadSigningKey();
  if (key === null) throw new Error("Generate, enter or import an Ed25519 signing key first");
  await validateSigningKey(key);
  return key;
};

const maintenancePlan = (): { regenerate: boolean; sign: boolean; gender: PreferredGender } => {
  if (maintenance === null) throw new Error("Open an .astral file first");
  const complete = element<HTMLInputElement>("#canonicaliseComplete")?.checked === true;
  const signOutput = element<HTMLInputElement>("#canonicaliseSign")?.checked === true;
  const gender = selectedMaintenanceGender();
  const changedGender = maintenance.request?.existingGender !== gender;
  const invalidIntegrity = maintenance.validation?.integrity !== "valid";
  return {
    regenerate: maintenance.current === null || invalidIntegrity || changedGender || complete,
    sign: signOutput,
    gender,
  };
};

const analyseMaintenance = (): void => {
  const status = maintenanceStatus();
  if (maintenance === null || status === null) return;
  const plan = maintenancePlan();
  const schema = record(maintenance.raw) ? stringValue(maintenance.raw["schema"]) ?? "unknown" : "unknown";
  const points: string[] = [
    `Detected schema: ${schema}.`,
    maintenance.current === null
      ? "The file is legacy or incomplete and must be regenerated into the current astral/1.1.0 schema."
      : "The file has the current astral/1.1.0 structure.",
    maintenance.request === null
      ? "The embedded birth data is not complete enough to regenerate this file automatically."
      : `Embedded birth data is usable for ${maintenance.request.options.primaryZodiac} regeneration.`,
    plan.regenerate
      ? "The update will recalculate deterministic fields and regenerate a complete interpretation using the configured API models."
      : "The update can preserve the current calculation and interpretation without an API call.",
    plan.sign
      ? "The output will be signed with the currently entered Ed25519 key; any existing authority will be replaced on the new copy."
      : "The output will remain unsigned unless an already-valid unchanged signature can be preserved.",
  ];
  status.replaceChildren(...points.map((value) => {
    const line = document.createElement("span");
    line.textContent = value;
    return line;
  }));
  status.className = maintenance.request === null && plan.regenerate
    ? "notice warning canonicalise-analysis"
    : "canonicalise-analysis";
  const run = element<HTMLButtonElement>("#canonicaliseRun");
  if (run !== null) run.disabled = plan.regenerate && maintenance.request === null;
};

const updatedName = (source: string): string => {
  const base = source.replace(/\.(?:astral|json)$/iu, "");
  return `${safeName(base)}-canonical.astral`;
};

const performMaintenance = async (): Promise<void> => {
  if (maintenance === null) throw new Error("Open an .astral file first");
  const status = maintenanceStatus();
  if (status === null) return;
  const plan = maintenancePlan();
  const key = plan.sign ? await selectedSigningKey() : null;
  let output: AstralFile;

  if (plan.regenerate) {
    if (maintenance.request === null) throw new Error("The file does not contain enough birth data to regenerate it");
    const apiKey = element<HTMLInputElement>("#openAiKey")?.value.trim()
      || localStorage.getItem(openAiStorageKey)?.trim()
      || "";
    if (apiKey.length === 0) throw new Error("Enter or import an OpenAI API key before regenerating missing fields");
    saveOpenAiKey(apiKey);
    const birth: BirthInput = { ...maintenance.request.birth, preferredGender: plan.gender };
    setStatus(status, "Recalculating the chart and completing every interpretation. This may take several minutes.");
    let completed = 0;
    const runtime = new BrowserRuntime(apiKey);
    const generated = await runtime.generate(
      birth,
      maintenance.request.options,
      {
        onComplete: () => {
          completed += 1;
          setStatus(status, `Rebuilding the canonical chart: ${completed} interpretation${completed === 1 ? "" : "s"} completed.`);
        },
        onCheckpoint: (checkpoint) => {
          const accepted = Object.keys(checkpoint.interpretation.units).length;
          setStatus(status, `Rebuilding the canonical chart: ${accepted} accepted interpretations are safely checkpointed in memory.`);
        },
      },
      key,
    );
    output = generated.file;
  } else {
    const current = maintenance.current;
    if (current === null) throw new Error("The current file cannot be canonicalised without regeneration");
    const authority = key === null
      ? null
      : { issuer: key.issuer, keys: key, generatedAt: new Date().toISOString() };
    const validation = maintenance.validation;
    const preserve = authority === null
      && validation?.integrity === "valid"
      && (validation.authority === "unsigned" || validation.authority === "valid_untrusted");
    output = preserve
      ? current
      : await assembleAstralFile(current["astral-calculation"], current["astral-chart"], authority);
  }

  const encoded = encodeAstralFile(output, true);
  downloadText(updatedName(maintenance.fileName), encoded, "application/json;charset=utf-8");
  setStatus(status, "Canonical current-schema chart downloaded successfully.");
};

const ensureMaintenanceUi = (): void => {
  if (element("#canonicaliseCard") !== null) return;
  const panel = element<HTMLElement>("#openPanel");
  const viewer = element<HTMLElement>("#viewerCard");
  if (panel === null || viewer === null) return;

  const card = document.createElement("section");
  card.id = "canonicaliseCard";
  card.className = "card hidden canonicalise-card";
  card.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Test maintenance tool</p>
        <h2>Canonicalise or update this chart</h2>
      </div>
      <span class="badge neutral">Creates a new copy</span>
    </div>
    <p class="notice">The unchanged download remains available below. This explicit tool can rebuild an old or incomplete file into the current schema, add preferred-gender metadata, complete interpretations and sign the resulting copy.</p>
    <div class="grid two canonicalise-options">
      <label>Preferred gender
        <select id="canonicaliseGender">
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="non-binary">Non-binary</option>
        </select>
      </label>
      <label class="check-option"><input id="canonicaliseComplete" type="checkbox"> Recalculate and complete all missing or invalid fields</label>
      <label class="check-option"><input id="canonicaliseSign" type="checkbox"> Sign the new copy with the entered Ed25519 key</label>
    </div>
    <div id="canonicaliseStatus" class="canonicalise-analysis"></div>
    <div class="actions">
      <button id="canonicaliseAnalyse" type="button" class="secondary">Analyse update</button>
      <button id="canonicaliseRun" type="button">Canonicalise and download</button>
    </div>`;
  panel.insertBefore(card, viewer);

  element<HTMLButtonElement>("#canonicaliseAnalyse")?.addEventListener("click", analyseMaintenance);
  element<HTMLButtonElement>("#canonicaliseRun")?.addEventListener("click", () => void performMaintenance()
    .catch((cause: unknown) => {
      const status = maintenanceStatus();
      if (status !== null) setStatus(status, cause instanceof Error ? cause.message : String(cause), true);
    }));
  for (const selector of ["#canonicaliseGender", "#canonicaliseComplete", "#canonicaliseSign"]) {
    element(selector)?.addEventListener("change", analyseMaintenance);
  }
};

const loadMaintenanceFile = async (file: File): Promise<void> => {
  ensureMaintenanceUi();
  const card = maintenanceCard();
  if (card === null) return;
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text()) as unknown;
  } catch (cause: unknown) {
    maintenance = null;
    card.classList.remove("hidden");
    const status = maintenanceStatus();
    if (status !== null) setStatus(status, cause instanceof Error ? cause.message : "The file is not valid JSON", true);
    return;
  }
  const current = isAstralFile(raw) ? raw : null;
  const validation = current === null ? null : await validateAstralFile(current);
  const request = extraction(raw);
  maintenance = { raw, fileName: file.name, current, validation, request };
  const gender = element<HTMLSelectElement>("#canonicaliseGender");
  if (gender !== null) gender.value = request?.existingGender ?? "male";
  const complete = element<HTMLInputElement>("#canonicaliseComplete");
  if (complete !== null) complete.checked = current === null || validation?.integrity !== "valid";
  const signOutput = element<HTMLInputElement>("#canonicaliseSign");
  if (signOutput !== null) signOutput.checked = loadSigningKey() !== null;
  card.classList.remove("hidden");
  analyseMaintenance();
  setTimeout(() => {
    const notice = element<HTMLElement>("#fileValidation");
    if (notice !== null) notice.textContent += " Use the maintenance tool to create an explicitly updated or newly signed copy.";
  }, 0);
};

const canonicalReadingTitle = (value: string): string => {
  const fixed: Readonly<Record<string, string>> = {
    "Your chart": "Chart details",
    "Your placements": "Planetary and calculated placements",
    "Your lunar phase": "Lunar phase calculation",
    "Rulers and dominant features": "Chart rulers and dominant features",
    "Chart balance": "Element, modality and polarity balance",
    "Major aspects": "Major aspect calculations",
    "Minor aspects": "Minor aspect calculations",
    "Declination aspects": "Declination aspect calculations",
    "Aspect patterns": "Calculated aspect patterns",
    "Eclipses": "Eclipse calculations",
    "Chart overview": "Overall chart interpretation",
    "Your Sun": "Sun: identity and vitality",
    "Your Moon": "Moon: emotions and instincts",
    "Your Ascendant": "Ascendant: outward style and approach",
    "How your chart fits together": "Integrated chart synthesis",
    "Final portrait": "Final personal portrait",
  };
  const selected = fixed[value];
  if (selected !== undefined) return selected;
  if (/ houses$/iu.test(value)) return "House cusps, rulers and occupants";
  if (/^House\s+\d+$/u.test(value)) return `${value} interpretation`;
  return value;
};

const technicalTitles = new Set([
  "Your chart",
  "Your placements",
  "Your lunar phase",
  "Rulers and dominant features",
  "Chart balance",
  "Major aspects",
  "Minor aspects",
  "Declination aspects",
  "Aspect patterns",
  "Eclipses",
]);

const technicalTitle = (value: string): boolean => technicalTitles.has(value) || / houses$/iu.test(value);

const categoryFor = (title: string, technical: boolean): { id: string; title: string } => {
  if (technical) return { id: "technical", title: "Technical chart data" };
  if (/compatibility/iu.test(title)) return { id: "compatibilities", title: "Compatibilities" };
  if (/^(?:How your chart fits together|Final portrait)$/u.test(title)) return { id: "synthesis", title: "Final synthesis" };
  if (/^House\s+\d+/u.test(title)) return { id: "houses", title: "House readings" };
  if (/(?:aspect|conjunction|opposition|square|trine|sextile|quincunx|pattern)/iu.test(title)) {
    return { id: "aspects", title: "Aspect and pattern readings" };
  }
  if (/(?:Romance|sexuality|partnership|family|childhood|children|friendship|community)/iu.test(title)) {
    return { id: "relationships", title: "Relationships, family and intimacy" };
  }
  if (/(?:Work style|Career|Business|Money|Public life|ambition)/iu.test(title)) {
    return { id: "work", title: "Work, money and public life" };
  }
  if (/(?:wellbeing|spirituality|unconscious|developmental|growth|transformation|restrictions|conflict)/iu.test(title)) {
    return { id: "growth", title: "Growth, wellbeing and spirituality" };
  }
  if (/(?:Sun|Moon|Ascendant|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|node|Lilith|Vertex|Fortune|Spirit)/iu.test(title)) {
    return { id: "points", title: "Planetary and point readings" };
  }
  return { id: "general", title: "General overview and life themes" };
};

const slug = (value: string): string => value
  .normalize("NFKD")
  .replaceAll(/[^A-Za-z0-9]+/gu, "-")
  .replaceAll(/^-+|-+$/gu, "")
  .toLocaleLowerCase("en-GB") || "section";

const readingFrom = (source: HTMLElement): ViewerReading => {
  const details = source instanceof HTMLDetailsElement;
  const originalTitle = details
    ? source.querySelector<HTMLElement>(":scope > summary .technical-group-title")?.textContent?.trim()
      ?? source.querySelector<HTMLElement>(":scope > summary")?.textContent?.trim()
      ?? "Chart section"
    : source.querySelector<HTMLElement>(":scope > h3")?.textContent?.trim() ?? "Chart section";
  const body = document.createElement("div");
  body.className = "chart-reading-body";
  const content = details
    ? source.querySelector<HTMLElement>(":scope > .technical-group-body")
    : source;
  if (content !== null) {
    for (const child of [...content.children]) {
      if (!details && child.tagName === "H3") continue;
      body.append(child);
    }
  }
  return {
    title: canonicalReadingTitle(originalTitle),
    technical: technicalTitle(originalTitle),
    body,
  };
};

const openHashTarget = (): void => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id.length === 0) return;
  const target = document.getElementById(id);
  if (target === null) return;
  if (target instanceof HTMLDetailsElement) target.open = true;
  const parent = target.closest<HTMLDetailsElement>("details.chart-category");
  if (parent !== null) parent.open = true;
  setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
};

let arranging = false;
const arrangeFormattedChart = (): void => {
  if (arranging) return;
  const host = element<HTMLElement>("#formattedChart");
  const view = element<HTMLElement>("#formattedView");
  if (host === null || view === null) return;
  const sources = [...host.children].filter((child): child is HTMLElement =>
    child instanceof HTMLElement && child.classList.contains("customer-group"));
  if (sources.length === 0) return;

  arranging = true;
  try {
    const order = ["general", "relationships", "work", "growth", "points", "houses", "aspects", "compatibilities", "synthesis", "technical"];
    const categories = new Map<string, ViewerCategory>();
    for (const source of sources) {
      const reading = readingFrom(source);
      const category = categoryFor(reading.title, reading.technical);
      const selected = categories.get(category.id) ?? { ...category, readings: [] };
      selected.readings.push(reading);
      categories.set(category.id, selected);
    }

    const nav = document.createElement("nav");
    nav.id = "formattedChartIndex";
    nav.className = "formatted-chart-index";
    nav.setAttribute("aria-label", "Formatted chart index");
    const navTitle = document.createElement("h3");
    navTitle.textContent = "Chart index";
    nav.append(navTitle);
    const navList = document.createElement("ul");
    nav.append(navList);

    const content = document.createDocumentFragment();
    for (const id of order) {
      const category = categories.get(id);
      if (category === undefined || category.readings.length === 0) continue;
      const categoryId = `chart-category-${category.id}`;
      const categoryDetails = document.createElement("details");
      categoryDetails.id = categoryId;
      categoryDetails.className = "chart-category";
      const categorySummary = document.createElement("summary");
      const categoryName = document.createElement("span");
      categoryName.textContent = category.title;
      const categoryCount = document.createElement("span");
      categoryCount.className = "chart-category-count";
      categoryCount.textContent = `${category.readings.length} section${category.readings.length === 1 ? "" : "s"}`;
      categorySummary.append(categoryName, categoryCount);
      const categoryBody = document.createElement("div");
      categoryBody.className = "chart-category-body";

      const navItem = document.createElement("li");
      const categoryLink = document.createElement("a");
      categoryLink.href = `#${categoryId}`;
      categoryLink.textContent = category.title;
      navItem.append(categoryLink);
      const readingList = document.createElement("ul");

      const used = new Map<string, number>();
      for (const reading of category.readings) {
        const base = `chart-section-${category.id}-${slug(reading.title)}`;
        const count = (used.get(base) ?? 0) + 1;
        used.set(base, count);
        const readingId = count === 1 ? base : `${base}-${count}`;
        const readingDetails = document.createElement("details");
        readingDetails.id = readingId;
        readingDetails.className = "chart-reading";
        const summary = document.createElement("summary");
        summary.textContent = reading.title;
        readingDetails.append(summary, reading.body);
        categoryBody.append(readingDetails);

        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = `#${readingId}`;
        link.textContent = reading.title;
        item.append(link);
        readingList.append(item);
      }
      navItem.append(readingList);
      navList.append(navItem);
      categoryDetails.append(categorySummary, categoryBody);
      content.append(categoryDetails);
    }

    host.replaceChildren(content);
    const oldIndex = element("#formattedChartIndex");
    oldIndex?.remove();
    view.insertBefore(nav, host);
    view.classList.add("chart-indexed");
    nav.addEventListener("click", (event) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href^='#']");
      if (link === null || link === undefined) return;
      const target = document.querySelector<HTMLElement>(link.hash);
      if (target === null) return;
      event.preventDefault();
      history.replaceState(null, "", link.hash);
      if (target instanceof HTMLDetailsElement) target.open = true;
      const parent = target.closest<HTMLDetailsElement>("details.chart-category");
      if (parent !== null) parent.open = true;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    openHashTarget();
  } finally {
    arranging = false;
  }
};

const observeFormattedChart = (): void => {
  const host = element<HTMLElement>("#formattedChart");
  if (host === null) return;
  let timer = 0;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = window.setTimeout(arrangeFormattedChart, 0);
  }).observe(host, { childList: true });
  arrangeFormattedChart();
  window.addEventListener("hashchange", openHashTarget);
};

const updateMaintenanceWarning = (): void => {
  const warning = element<HTMLElement>(".credential-warning");
  if (warning === null) return;
  warning.textContent = "Normal chart generation signs only the chart being completed. The explicit test maintenance tool can create a separate canonical copy of an opened file and sign that new copy when requested.";
};

const initialise = (): void => {
  enhanceOpenAiKey();
  enhanceSigningKey();
  ensureMaintenanceUi();
  observeFormattedChart();
  updateMaintenanceWarning();
  const file = element<HTMLInputElement>("#astralFile");
  file?.addEventListener("change", () => {
    const selected = file.files?.[0];
    if (selected !== undefined) void loadMaintenanceFile(selected);
  });
};

initialise();
