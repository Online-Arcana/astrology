import { billingSummary } from "../billing/bill.js";
import type { ChartBill, UsageGroup } from "../billing/types.js";
import type { CalculationOptions } from "../calculate/service.js";
import {
  decodeReadableAstralFile,
  encodeAstralFile,
  isAstralFile,
  validateAstralFile,
} from "../file/validate.js";
import type {
  ChartGenerationCheckpoint,
  GenerationHooks,
  ResumableChartGenerationCheckpoint,
} from "../generate/service.js";
import type { InterpretationDiagnostic, WaveCheckpoint } from "../llm/orchestrate/types.js";
import { loadCscCatalogue } from "../place/csc.js";
import type { CityChoice, CountryChoice, RegionChoice } from "../place/model.js";
import type { BirthInput, PreferredGender } from "../types/base.js";
import type { Ayanamsha, Zodiac } from "../types/astro.js";
import type { AstralFile } from "../types/file.js";
import {
  generateSigningKey,
  loadOpenAiKey,
  loadSigningKey,
  parseSigningKey,
  saveOpenAiKey,
  saveSigningKey,
  signingKeyId,
  signingKeyText,
  validateSigningKey,
  type BrowserSigningKey,
} from "./keys.js";
import { correctionSummary, unitLabel } from "./labels.js";
import { customerGroups } from "./pretty.js";
import { BrowserRuntime, browserVersion } from "./runtime.js";
import { BrowserStore, type BrowserChart, type BrowserJob } from "./store.js";

interface GenerationRequest {
  birth: BirthInput;
  options: CalculationOptions;
}

const select = <T extends Element>(selector: string): T => {
  const value = document.querySelector<T>(selector);
  if (value === null) throw new Error(`Missing browser element ${selector}`);
  return value;
};

const input = (selector: string): HTMLInputElement => select<HTMLInputElement>(selector);
const choice = (selector: string): HTMLSelectElement => select<HTMLSelectElement>(selector);
const button = (selector: string): HTMLButtonElement => select<HTMLButtonElement>(selector);
const element = (selector: string): HTMLElement => select<HTMLElement>(selector);
const text = (selector: string, value: string): void => { element(selector).textContent = value; };
const hidden = (selector: string, value: boolean): void => {
  element(selector).classList.toggle("hidden", value);
};

const store = new BrowserStore();
const places = loadCscCatalogue();
let signingKey: BrowserSigningKey | null = loadSigningKey();
let generatedFile: AstralFile | null = null;
let openedFile: AstralFile | null = null;
let openedText: string | null = null;
let activeJobId: string | null = null;
let activeRequest: GenerationRequest | null = null;
let activeCheckpoint: ChartGenerationCheckpoint | null = null;
let activeWave: WaveCheckpoint | null = null;
let activeBill: ChartBill | null = null;
let abortController: AbortController | null = null;
const repairingUnits = new Set<string>();

const now = (): string => new Date().toISOString();
const formatTokens = (value: number): string => new Intl.NumberFormat("en-GB").format(value);
const formatUsd = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : `$${value.toFixed(6)}`;
const formatDate = (value: string): string => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

const clearError = (): void => {
  hidden("#errorCard", true);
  text("#errorMessage", "");
};

const showError = (cause: unknown): void => {
  const message = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
  text("#errorMessage", message);
  hidden("#errorCard", false);
  element("#errorCard").scrollIntoView({ behavior: "smooth", block: "start" });
};

const download = (name: string, content: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const chartName = (file: AstralFile): string => file["astral-chart"].subject.name.value
  .replaceAll(/[^\p{L}\p{N}._-]+/gu, "-")
  .replaceAll(/^-+|-+$/gu, "") || "chart";

const finalAstralText = (file: AstralFile): string => encodeAstralFile(file, true);

const setPanel = (id: string): void => {
  for (const panel of document.querySelectorAll<HTMLElement>(".panel")) panel.classList.toggle("active", panel.id === id);
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".tab")) tab.classList.toggle("active", tab.dataset["panel"] === id);
};

const setFileView = (id: string): void => {
  for (const view of document.querySelectorAll<HTMLElement>(".file-view")) view.classList.toggle("active", view.id === id);
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".subtab")) tab.classList.toggle("active", tab.dataset["view"] === id);
};

const fill = <T>(
  target: HTMLSelectElement,
  values: readonly T[],
  value: (item: T) => string,
  label: (item: T) => string,
  empty: string,
): void => {
  target.replaceChildren(new Option(empty, ""));
  for (const item of values) {
    const option = new Option(label(item), value(item));
    option.dataset["item"] = JSON.stringify(item);
    target.add(option);
  }
  target.disabled = values.length === 0;
};

const selectedItem = <T>(target: HTMLSelectElement): T | null => {
  const raw = target.selectedOptions[0]?.dataset["item"];
  if (raw === undefined) return null;
  return JSON.parse(raw) as T;
};

const loadContinents = async (): Promise<void> => {
  const catalogue = await places;
  const values = await catalogue.continents();
  fill(choice("#continent"), values, (value) => value, (value) => value, "Choose a continent");
  choice("#continent").disabled = false;
};

const loadCountries = async (): Promise<void> => {
  const continent = choice("#continent").value;
  fill(choice("#country"), [], String, String, "Choose a country");
  fill(choice("#region"), [], String, String, "Search the whole country");
  fill(choice("#city"), [], String, String, "Search and choose a city");
  text("#selectedPlace", "No birth place selected.");
  if (continent.length === 0) return;
  const values = await (await places).countries(continent);
  fill(choice("#country"), values, (item: CountryChoice) => item.code, (item) => `${item.name} (${item.code})`, "Choose a country");
};

const loadRegions = async (): Promise<void> => {
  const country = choice("#country").value;
  fill(choice("#region"), [], String, String, "Search the whole country");
  fill(choice("#city"), [], String, String, "Search and choose a city");
  text("#selectedPlace", "No birth place selected.");
  if (country.length === 0) return;
  const values = await (await places).regions(country);
  fill(choice("#region"), values, (item: RegionChoice) => item.code, (item) => item.name, "Search the whole country");
  choice("#region").disabled = false;
};

const searchCities = async (): Promise<void> => {
  clearError();
  const country = choice("#country").value;
  if (country.length === 0) throw new Error("Choose a country before searching for a city");
  const query = input("#cityQuery").value.trim();
  if (query.length < 2) throw new Error("Enter at least two characters of the city name");
  button("#searchCities").disabled = true;
  try {
    const values = await (await places).cities(country, choice("#region").value || null, query);
    fill(
      choice("#city"),
      values,
      (item: CityChoice) => item.id,
      (item) => `${item.name}${item.region === null ? "" : `, ${item.region.name}`} · ${item.timeZone || "timezone unavailable"}`,
      values.length === 0 ? "No matching cities" : "Choose a city",
    );
  } finally {
    button("#searchCities").disabled = false;
  }
};

const updateSelectedPlace = (): void => {
  const city = selectedItem<CityChoice>(choice("#city"));
  if (city === null) {
    text("#selectedPlace", "No birth place selected.");
    return;
  }
  text("#selectedPlace", `${city.name}${city.region === null ? "" : `, ${city.region.name}`} · ${city.latitude.toFixed(4)}, ${city.longitude.toFixed(4)} · ${city.timeZone}`);
};

const requestFromForm = (): GenerationRequest => {
  const city = selectedItem<CityChoice>(choice("#city"));
  if (city === null) throw new Error("Search for and choose a birth city");
  const accuracy = choice("#timeAccuracy").value as BirthInput["timeAccuracy"];
  const enteredTime = input("#time").value;
  if (accuracy !== "unknown" && enteredTime.length === 0) {
    throw new Error("Enter a birth time or choose Unknown time accuracy");
  }
  const birth: BirthInput = {
    date: input("#date").value,
    time: accuracy === "unknown" ? null : enteredTime,
    timeAccuracy: accuracy,
    placeId: city.id,
  };
  if (birth.date.length === 0) throw new Error("Enter a birth date");
  const name = input("#name").value.trim();
  const lang = input("#lang").value.trim();
  const gender = choice("#preferredGender").value;
  if (name.length > 0) birth.name = name;
  if (lang.length > 0) birth.lang = lang;
  if (gender === "male" || gender === "female" || gender === "non-binary") {
    birth.preferredGender = gender satisfies PreferredGender;
  }
  const zodiac = choice("#zodiac").value as Zodiac;
  return {
    birth,
    options: {
      primaryZodiac: zodiac,
      interpretationMode: zodiac,
      ayanamsha: choice("#ayanamsha").value as Ayanamsha,
    },
  };
};

const checkpointCompleted = (checkpoint: ChartGenerationCheckpoint): number => {
  const accepted = Object.keys(checkpoint.interpretation.units).length;
  const staged = Object.keys(checkpoint.interpretation.wave?.staged ?? {}).length;
  return accepted + staged;
};

const checkpointTotal = (checkpoint: ChartGenerationCheckpoint): number =>
  checkpoint.calculation.interpretationPlan.units.length
  + (checkpoint.calculation.subject.providedName === null ? 1 : 0);

const renderLanes = (): void => {
  const host = element("#laneList");
  host.replaceChildren();
  const lanes = activeWave?.lanes ?? [];
  for (const lane of lanes) {
    const card = document.createElement("article");
    card.className = "lane-card";
    const eyebrow = document.createElement("span");
    eyebrow.textContent = lane.id.replace("lane-", "Lane ");
    const heading = document.createElement("strong");
    const active = lane.active;
    heading.textContent = active === null ? (lane.status === "complete" ? "Wave work complete" : "Waiting for assignment") : unitLabel(active.id);
    const status = document.createElement("span");
    status.textContent = active === null
      ? lane.status
      : repairingUnits.has(active.id)
        ? "Correcting audited output with the small model"
        : `Attempt ${active.attempt} · ${lane.status}`;
    card.append(eyebrow, heading, status);
    host.append(card);
  }
};

const renderProgress = (): void => {
  hidden("#progressCard", activeJobId === null);
  if (activeJobId === null) return;
  const checkpoint = activeCheckpoint;
  const completed = checkpoint === null ? 0 : checkpointCompleted(checkpoint);
  const total = checkpoint === null ? 0 : checkpointTotal(checkpoint);
  const percent = total === 0 ? 0 : Math.min(100, completed / total * 100);
  element("#progressBar").style.width = `${percent}%`;
  text("#progressNumbers", `${completed} of ${total} interpretations accepted or safely staged`);
  if (repairingUnits.size > 0) {
    text("#progressSummary", correctionSummary(repairingUnits.size));
  } else {
    const active = activeWave?.lanes.filter((lane) => lane.active !== null).length ?? 0;
    text(
      "#progressSummary",
      active > 0
        ? `${active} distinct model request${active === 1 ? " is" : "s are"} running in parallel. Accepted work remains safe.`
        : "Preparing or assembling the next safe generation stage.",
    );
  }
  renderLanes();
};

const usageRow = (group: UsageGroup, maximum: number): HTMLElement => {
  const row = document.createElement("div");
  row.className = "usage-row";
  const top = document.createElement("div");
  top.className = "usage-top";
  const name = document.createElement("strong");
  name.textContent = group.key.startsWith("client-") ? `Lane ${group.key.slice("client-".length)}` : group.key;
  const detail = document.createElement("span");
  detail.textContent = `${formatTokens(group.totalTokens)} tokens · ${formatUsd(group.costUsd)}`;
  top.append(name, detail);
  const track = document.createElement("div");
  track.className = "usage-bar";
  const fill = document.createElement("span");
  fill.style.width = `${Math.min(100, group.totalTokens / Math.max(1, maximum) * 100)}%`;
  track.append(fill);
  row.append(top, track);
  return row;
};

const historicalAverage = async (): Promise<number | null> =>
  billingSummary(await store.bills()).averageCompletedChartCostUsd;

const renderBill = async (bill: ChartBill | null): Promise<void> => {
  activeBill = bill;
  hidden("#billingPanel", bill === null);
  if (bill === null) return;
  text("#billingCost", formatUsd(bill.total.costUsd));
  text("#billingTokens", formatTokens(bill.total.totalTokens));
  text("#billingInputTokens", `${formatTokens(bill.total.inputTokens)} / ${formatTokens(bill.total.cachedInputTokens)}`);
  text("#billingOutputTokens", `${formatTokens(bill.total.outputTokens)} / ${formatTokens(bill.total.reasoningTokens)}`);
  text("#billingAverage", formatUsd(await historicalAverage()));
  text("#billingStatus", bill.status === "running" ? "Live usage from completed API responses" : `Finalised ${bill.status} bill`);
  const laneHost = element("#billingLaneList");
  laneHost.replaceChildren(...bill.byLane.map((group) => usageRow(group, 60_000)));
  const modelMaximum = Math.max(1, ...bill.byModel.map(({ totalTokens }) => totalTokens));
  const modelHost = element("#billingModelList");
  modelHost.replaceChildren(...bill.byModel.map((group) => usageRow(group, modelMaximum)));
  text(
    "#billingPriceNote",
    bill.pricing.complete
      ? `Estimated using ${bill.pricing.catalogue}, effective ${bill.pricing.effectiveAt}.`
      : "Some model usage is unpriced; the shown total is incomplete.",
  );
};

const diagnostic = (event: InterpretationDiagnostic): void => {
  if (event.unitId === null) return;
  if (event.kind === "complete") repairingUnits.delete(event.unitId);
  if (event.kind === "retry" || event.repairKind === "audit_correction" || event.repairKind === "completion_condensation") {
    repairingUnits.add(event.unitId);
  }
  renderProgress();
};

const saveActiveJob = async (checkpoint: ChartGenerationCheckpoint): Promise<void> => {
  if (activeJobId === null || activeRequest === null) return;
  activeCheckpoint = checkpoint;
  await store.put<BrowserJob>("jobs", {
    id: activeJobId,
    status: "running",
    createdAt: (await store.get<BrowserJob>("jobs", activeJobId))?.createdAt ?? now(),
    updatedAt: now(),
    request: activeRequest,
    checkpoint,
    error: null,
  });
  renderProgress();
  await renderRecoveries();
};

const hooks = (): GenerationHooks => ({
  onCheckpoint: saveActiveJob,
  onWave: async (wave) => {
    activeWave = wave;
    renderProgress();
  },
  onDiagnostic: diagnostic,
  onRepair: (unit) => {
    repairingUnits.add(unit.id);
    renderProgress();
  },
  onComplete: (result) => {
    repairingUnits.delete(result.id);
    renderProgress();
  },
  onBill: (bill) => {
    void store.put<ChartBill>("bills", bill);
    void renderBill(bill);
  },
});

const savedSigningKey = (): BrowserSigningKey | null => signingKey;

const clearActiveGeneration = (): void => {
  activeJobId = null;
  activeRequest = null;
  activeCheckpoint = null;
  activeWave = null;
  repairingUnits.clear();
  abortController = null;
  renderProgress();
};

const completeGeneration = async (result: Awaited<ReturnType<BrowserRuntime["generate"]>>): Promise<void> => {
  generatedFile = result.file;
  const fingerprint = result.calculation.provenance.calculationFingerprint;
  const chart: BrowserChart = {
    id: fingerprint,
    createdAt: result.file["astral-chart"].provenance.generatedAt,
    file: result.file,
    bill: result.bill,
  };
  await store.put<BrowserChart>("charts", chart);
  if (result.bill !== null) await store.put<ChartBill>("bills", result.bill);
  if (activeJobId !== null) await store.delete("jobs", activeJobId);
  clearActiveGeneration();
  await renderBill(result.bill);
  hidden("#completeCard", false);
  text("#completeAuthority", result.file.authority === null ? "Unsigned" : "Signed by this browser key");
  element("#completeAuthority").className = `badge ${result.file.authority === null ? "warn" : "good"}`;
  element("#completeCard").scrollIntoView({ behavior: "smooth", block: "start" });
  await Promise.all([renderRecoveries(), renderHistory()]);
};

const runGeneration = async (
  id: string,
  request: GenerationRequest,
  checkpoint: ResumableChartGenerationCheckpoint | null,
): Promise<void> => {
  clearError();
  const apiKey = loadOpenAiKey();
  if (apiKey.length === 0) throw new Error("Enter and save an OpenAI API key before generating a chart");
  activeJobId = id;
  activeRequest = request;
  activeCheckpoint = checkpoint !== null && "calculation" in checkpoint ? checkpoint as ChartGenerationCheckpoint : null;
  activeWave = activeCheckpoint?.interpretation.wave ?? null;
  activeBill = activeCheckpoint?.billing ?? null;
  repairingUnits.clear();
  abortController = new AbortController();
  hidden("#completeCard", true);
  renderProgress();
  await renderBill(activeBill);
  button("#generateButton").disabled = true;
  try {
    const runtime = new BrowserRuntime(apiKey, abortController.signal);
    const result = checkpoint === null
      ? await runtime.generate(request.birth, request.options, hooks(), savedSigningKey())
      : await runtime.resume(checkpoint, hooks(), savedSigningKey());
    await completeGeneration(result);
  } catch (cause: unknown) {
    const stopped = abortController?.signal.aborted === true;
    if (activeJobId !== null && activeCheckpoint !== null && activeRequest !== null) {
      await store.put<BrowserJob>("jobs", {
        id: activeJobId,
        status: stopped ? "stopped" : "failed",
        createdAt: (await store.get<BrowserJob>("jobs", activeJobId))?.createdAt ?? now(),
        updatedAt: now(),
        request: activeRequest,
        checkpoint: activeCheckpoint,
        error: stopped ? null : cause instanceof Error ? cause.message : String(cause),
      });
    }
    if (activeBill !== null && activeBill.status !== "running") {
      await store.put<ChartBill>("bills", activeBill);
    }
    clearActiveGeneration();
    if (!stopped) showError(cause);
  } finally {
    button("#generateButton").disabled = false;
    abortController = null;
    await Promise.all([renderRecoveries(), renderHistory()]);
  }
};

const startGeneration = async (): Promise<void> => {
  const request = requestFromForm();
  const id = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  await runGeneration(id, request, null);
};

const resumeJob = async (job: BrowserJob): Promise<void> => {
  const request = job.request as GenerationRequest;
  await runGeneration(job.id, request, job.checkpoint);
};

const renderRecoveries = async (): Promise<void> => {
  const jobs = (await store.jobs()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  hidden("#recoveryCard", jobs.length === 0);
  const host = element("#recoveryList");
  host.replaceChildren();
  for (const job of jobs) {
    const record = document.createElement("article");
    record.className = "record";
    const info = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = `Chart ${job.id}`;
    const detail = document.createElement("span");
    detail.textContent = `${job.status} · ${checkpointCompleted(job.checkpoint)} of ${checkpointTotal(job.checkpoint)} safe units · updated ${formatDate(job.updatedAt)}`;
    info.append(heading, detail);
    const actions = document.createElement("div");
    actions.className = "actions";
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "secondary";
    resume.textContent = "Resume";
    resume.disabled = activeJobId !== null;
    resume.addEventListener("click", () => void resumeJob(job));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => void store.delete("jobs", job.id).then(renderRecoveries));
    actions.append(resume, remove);
    record.append(info, actions);
    host.append(record);
  }
};

const renderFormatted = (file: AstralFile): void => {
  const host = element("#formattedChart");
  host.replaceChildren();
  for (const group of customerGroups(file)) {
    const section = document.createElement("section");
    section.className = "customer-group";
    const heading = document.createElement("h3");
    heading.textContent = group.title;
    const list = document.createElement("dl");
    list.style.margin = "0";
    for (const item of group.rows) {
      const wrapper = document.createElement("div");
      wrapper.className = "customer-row";
      const term = document.createElement("dt");
      term.textContent = item.label;
      const description = document.createElement("dd");
      description.textContent = item.value;
      wrapper.append(term, description);
      list.append(wrapper);
    }
    section.append(heading, list);
    host.append(section);
  }
};

const authorityStatus = async (file: AstralFile): Promise<{ label: string; className: string }> => {
  const validation = await validateAstralFile(file);
  if (file.authority === null) return { label: "Unsigned", className: "badge warn" };
  if (validation.authority === "invalid") return { label: "Invalid signature", className: "badge bad" };
  const key = signingKey;
  if (key !== null && file.authority.keyId === await signingKeyId(key)) {
    return { label: "Made by this browser key", className: "badge good" };
  }
  return { label: "Signed by another authority", className: "badge neutral" };
};

const showFile = async (file: AstralFile, raw: string): Promise<void> => {
  openedFile = file;
  openedText = raw;
  const validation = await validateAstralFile(file);
  text("#fileValidation", `Structure ${validation.structure}; integrity ${validation.integrity}; authority ${validation.authority}. Imported unsigned files remain unsigned.`);
  const authority = await authorityStatus(file);
  text("#fileAuthority", authority.label);
  element("#fileAuthority").className = authority.className;
  renderFormatted(file);
  text("#rawChart", JSON.stringify(file, null, 2));
  hidden("#viewerCard", false);
  setFileView("formattedView");
};

const openAstral = async (file: File): Promise<void> => {
  clearError();
  const raw = await file.text();
  const readable = decodeReadableAstralFile(raw);
  if (!isAstralFile(readable)) {
    openedFile = null;
    openedText = raw;
    text("#fileAuthority", readable.authority === null ? "Legacy unsigned file" : "Legacy signed file");
    element("#fileAuthority").className = "badge warn";
    text("#fileValidation", "This legacy file can be inspected in Raw view. It is never upgraded or signed by the browser.");
    text("#rawChart", JSON.stringify(readable, null, 2));
    element("#formattedChart").replaceChildren();
    hidden("#viewerCard", false);
    setFileView("rawView");
    return;
  }
  await showFile(readable, raw);
};

const renderHistory = async (): Promise<void> => {
  const charts = (await store.charts()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const bills = await store.bills();
  const summary = billingSummary(bills);
  text("#historyCharts", String(charts.length));
  text("#historyBills", String(bills.length));
  text("#historyTokens", formatTokens(summary.totalUsage.totalTokens));
  text("#historyAverage", formatUsd(summary.averageCompletedChartCostUsd));
  const host = element("#chartHistory");
  host.replaceChildren();
  for (const chart of charts) {
    const record = document.createElement("article");
    record.className = "record";
    const info = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = chart.file["astral-chart"].subject.name.value;
    const detail = document.createElement("span");
    detail.textContent = `${formatDate(chart.createdAt)} · ${chart.file.authority === null ? "unsigned" : "signed"} · ${formatUsd(chart.bill?.total.costUsd)}`;
    info.append(heading, detail);
    const actions = document.createElement("div");
    actions.className = "actions";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "secondary";
    open.textContent = "Open";
    open.addEventListener("click", () => {
      setPanel("openPanel");
      void showFile(chart.file, finalAstralText(chart.file));
    });
    const save = document.createElement("button");
    save.type = "button";
    save.className = "ghost";
    save.textContent = "Download";
    save.addEventListener("click", () => download(`${chartName(chart.file)}.astral`, finalAstralText(chart.file)));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => void store.delete("charts", chart.id).then(renderHistory));
    actions.append(open, save, remove);
    record.append(info, actions);
    host.append(record);
  }
};

const updateKeyIdentity = async (): Promise<void> => {
  if (signingKey === null) {
    text("#keyIdentity", "No signing identity");
    return;
  }
  text("#keyIdentity", `${signingKey.issuer} · ${(await signingKeyId(signingKey)).slice(0, 22)}…`);
};

const saveKeysFromForm = async (): Promise<void> => {
  saveOpenAiKey(input("#openAiKey").value);
  const signingText = input("#signingKey").value.trim();
  if (signingText.length > 0) {
    const key = parseSigningKey(signingText);
    await validateSigningKey(key);
    signingKey = key;
    saveSigningKey(key);
  }
  await updateKeyIdentity();
  text("#runtimeBadge", "Keys saved locally");
  element("#runtimeBadge").className = "badge good";
};

const initialise = async (): Promise<void> => {
  input("#openAiKey").value = loadOpenAiKey();
  if (signingKey !== null) input("#signingKey").value = signingKeyText(signingKey);
  await Promise.all([loadContinents(), renderRecoveries(), renderHistory(), updateKeyIdentity()]);
  text("#runtimeBadge", `Browser runtime ${browserVersion}`);
  element("#runtimeBadge").className = "badge good";
};

for (const tab of document.querySelectorAll<HTMLButtonElement>(".tab")) {
  tab.addEventListener("click", () => setPanel(tab.dataset["panel"] ?? "createPanel"));
}
for (const tab of document.querySelectorAll<HTMLButtonElement>(".subtab")) {
  tab.addEventListener("click", () => setFileView(tab.dataset["view"] ?? "formattedView"));
}

choice("#continent").addEventListener("change", () => void loadCountries().catch(showError));
choice("#country").addEventListener("change", () => void loadRegions().catch(showError));
choice("#region").addEventListener("change", () => {
  fill(choice("#city"), [], String, String, "Search and choose a city");
  text("#selectedPlace", "No birth place selected.");
});
choice("#city").addEventListener("change", updateSelectedPlace);
button("#searchCities").addEventListener("click", () => void searchCities().catch(showError));
choice("#timeAccuracy").addEventListener("change", () => {
  const unknown = choice("#timeAccuracy").value === "unknown";
  input("#time").disabled = unknown;
  input("#time").required = !unknown;
  if (unknown) input("#time").value = "";
});
choice("#zodiac").addEventListener("change", () => {
  choice("#ayanamsha").disabled = choice("#zodiac").value !== "sidereal";
});
select<HTMLFormElement>("#chartForm").addEventListener("submit", (event) => {
  event.preventDefault();
  void startGeneration().catch(showError);
});
button("#stopButton").addEventListener("click", () => {
  abortController?.abort(new DOMException("Generation stopped by the user", "AbortError"));
  text("#progressSummary", "Stopping safely. The latest accepted checkpoint remains in this browser.");
});
button("#saveOpenAiKey").addEventListener("click", () => void saveKeysFromForm().catch(showError));
button("#saveSigningKey").addEventListener("click", () => void saveKeysFromForm().catch(showError));
button("#clearOpenAiKey").addEventListener("click", () => {
  input("#openAiKey").value = "";
  saveOpenAiKey("");
});
button("#clearSigningKey").addEventListener("click", () => {
  signingKey = null;
  input("#signingKey").value = "";
  saveSigningKey(null);
  void updateKeyIdentity();
});
button("#generateSigningKey").addEventListener("click", () => void (async () => {
  const key = await generateSigningKey();
  await validateSigningKey(key);
  signingKey = key;
  saveSigningKey(key);
  input("#signingKey").value = signingKeyText(key);
  await updateKeyIdentity();
})().catch(showError));
input("#astralFile").addEventListener("change", () => {
  const file = input("#astralFile").files?.[0];
  if (file !== undefined) void openAstral(file).catch(showError);
});
button("#downloadGenerated").addEventListener("click", () => {
  if (generatedFile !== null) download(`${chartName(generatedFile)}.astral`, finalAstralText(generatedFile));
});
button("#viewGenerated").addEventListener("click", () => {
  if (generatedFile === null) return;
  setPanel("openPanel");
  void showFile(generatedFile, finalAstralText(generatedFile));
});
button("#downloadOpened").addEventListener("click", () => {
  if (openedText === null) return;
  download(openedFile === null ? "opened-chart.astral" : `${chartName(openedFile)}.astral`, openedText);
});
button("#refreshHistory").addEventListener("click", () => void renderHistory().catch(showError));

void initialise().catch(showError);
