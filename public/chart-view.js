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

const isTechnicalTitle = (title) => technicalTitles.has(title) || / houses$/u.test(title);

const technicalDetails = (section) => {
  const title = section.querySelector(":scope > h3")?.textContent?.trim() ?? "Chart positions";
  const details = document.createElement("details");
  details.className = "customer-group technical-group";
  details.dataset.chartViewEnhanced = "true";

  const summary = document.createElement("summary");
  const heading = document.createElement("span");
  heading.className = "technical-group-title";
  heading.textContent = title;
  const action = document.createElement("span");
  action.className = "technical-group-action";
  action.textContent = "Show positions";
  summary.append(heading, action);

  const body = document.createElement("div");
  body.className = "technical-group-body";
  for (const child of [...section.children]) {
    if (child.tagName !== "H3") body.append(child);
  }

  details.addEventListener("toggle", () => {
    action.textContent = details.open ? "Hide positions" : "Show positions";
  });
  details.append(summary, body);
  return details;
};

let reordering = false;
const reorderFormattedView = () => {
  if (reordering) return;
  const host = document.querySelector("#formattedChart");
  if (!(host instanceof HTMLElement)) return;
  const groups = [...host.children].filter((child) => child.classList.contains("customer-group"));
  if (groups.length === 0 || groups.every((group) => group.dataset.chartViewEnhanced === "true")) return;

  const technical = [];
  for (const group of groups) {
    if (!(group instanceof HTMLElement) || group.dataset.chartViewEnhanced === "true") break;
    const title = group.querySelector(":scope > h3")?.textContent?.trim() ?? "";
    if (!isTechnicalTitle(title)) break;
    technical.push(group);
  }
  if (technical.length === 0) return;

  reordering = true;
  try {
    const collapsed = technical.map(technicalDetails);
    technical.forEach((group) => group.remove());
    host.append(...collapsed);
  } finally {
    reordering = false;
  }
};

const formattedHost = document.querySelector("#formattedChart");
if (formattedHost instanceof HTMLElement) {
  new MutationObserver(reorderFormattedView).observe(formattedHost, { childList: true });
  reorderFormattedView();
}

const progressCard = document.querySelector("#progressCard");
const progressNumbers = document.querySelector("#progressNumbers");
const progressState = {
  jobId: null,
  startedAt: Date.now(),
  startingCompleted: 0,
  lastCompleted: 0,
  lastTotal: 0,
};

const progressMeta = () => {
  let host = document.querySelector("#generationStatusMeta");
  if (host instanceof HTMLElement) return host;
  if (!(progressNumbers instanceof HTMLElement)) return null;

  host = document.createElement("div");
  host.id = "generationStatusMeta";
  host.className = "generation-status-meta";
  host.innerHTML = `
    <div class="generation-stat">
      <span>Progress</span>
      <strong id="generationPercent">0%</strong>
    </div>
    <div class="generation-stat">
      <span>Estimated time remaining</span>
      <strong id="generationEta">Calculating…</strong>
    </div>
    <div class="generation-stat recovery-key-stat">
      <span>Recovery key</span>
      <div class="recovery-key-value">
        <code id="activeRecoveryKey">Waiting for the first safe checkpoint…</code>
        <button id="copyActiveRecoveryKey" type="button" class="ghost" disabled>Copy</button>
      </div>
    </div>`;
  progressNumbers.insertAdjacentElement("afterend", host);

  const copy = host.querySelector("#copyActiveRecoveryKey");
  copy?.addEventListener("click", () => void copyRecoveryKey());
  return host;
};

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "Calculating…";
  if (seconds < 45) return "Less than a minute";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `About ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `About ${hours} hr` : `About ${hours} hr ${remainder} min`;
};

const copyText = async (value) => {
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
  document.execCommand("copy");
  temporary.remove();
};

const copyRecoveryKey = async () => {
  const key = document.querySelector("#activeRecoveryKey")?.textContent?.trim() ?? "";
  if (!/^[a-f0-9]{12}$/u.test(key)) return;
  await copyText(key);
  const button = document.querySelector("#copyActiveRecoveryKey");
  if (!(button instanceof HTMLButtonElement)) return;
  button.textContent = "Copied";
  setTimeout(() => { button.textContent = "Copy"; }, 1200);
};

const setRecoveryKey = (jobId) => {
  if (!/^[a-f0-9]{12}$/u.test(jobId)) return;
  if (progressState.jobId !== null && progressState.jobId !== jobId) {
    progressState.startedAt = Date.now();
    progressState.startingCompleted = progressState.lastCompleted;
  }
  progressState.jobId = jobId;
  const output = document.querySelector("#activeRecoveryKey");
  if (output !== null) output.textContent = jobId;
  const copy = document.querySelector("#copyActiveRecoveryKey");
  if (copy instanceof HTMLButtonElement) copy.disabled = false;
};

const recoveryKeyFromRecords = () => {
  const heading = document.querySelector("#recoveryList .record strong")?.textContent ?? "";
  const match = /^Chart\s+([a-f0-9]{12})$/u.exec(heading.trim());
  return match?.[1] ?? null;
};

const openJobsDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open("astral-browser", 1);
  request.addEventListener("success", () => resolve(request.result), { once: true });
  request.addEventListener("error", () => reject(request.error ?? new Error("Could not open recovery storage")), { once: true });
});

const latestRecoveryKey = async () => {
  const fromRecords = recoveryKeyFromRecords();
  if (fromRecords !== null) return fromRecords;
  const database = await openJobsDatabase();
  try {
    if (!database.objectStoreNames.contains("jobs")) return null;
    const transaction = database.transaction("jobs", "readonly");
    const jobs = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("jobs").getAll();
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error ?? new Error("Could not read recovery jobs")), { once: true });
    });
    const latest = jobs
      .filter((job) => typeof job?.id === "string")
      .sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")))[0];
    return latest?.id ?? null;
  } finally {
    database.close();
  }
};

let recoveryReadPending = false;
const syncRecoveryKey = async () => {
  if (recoveryReadPending || progressCard?.classList.contains("hidden") !== false) return;
  recoveryReadPending = true;
  try {
    const key = await latestRecoveryKey();
    if (typeof key === "string") setRecoveryKey(key);
  } catch {
    // Progress remains usable when IndexedDB is unavailable.
  } finally {
    recoveryReadPending = false;
  }
};

const syncProgress = () => {
  progressMeta();
  const raw = progressNumbers?.textContent ?? "";
  const match = /(\d+)\s+of\s+(\d+)/u.exec(raw);
  if (match === null) return;
  const completed = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);
  progressState.lastCompleted = completed;
  progressState.lastTotal = total;

  const percent = total === 0 ? 0 : Math.min(100, completed / total * 100);
  const percentOutput = document.querySelector("#generationPercent");
  if (percentOutput !== null) percentOutput.textContent = `${Math.round(percent)}%`;

  const progressed = completed - progressState.startingCompleted;
  const remaining = Math.max(0, total - completed);
  const elapsedSeconds = (Date.now() - progressState.startedAt) / 1000;
  const etaSeconds = progressed > 0 ? elapsedSeconds / progressed * remaining : Number.NaN;
  const etaOutput = document.querySelector("#generationEta");
  if (etaOutput !== null) {
    etaOutput.textContent = remaining === 0 && total > 0 ? "Complete" : formatDuration(etaSeconds);
  }
  void syncRecoveryKey();
};

progressMeta();
if (progressNumbers instanceof HTMLElement) {
  new MutationObserver(syncProgress).observe(progressNumbers, { childList: true, characterData: true, subtree: true });
}
if (progressCard instanceof HTMLElement) {
  new MutationObserver(syncProgress).observe(progressCard, { attributes: true, attributeFilter: ["class"] });
}
const recoveryList = document.querySelector("#recoveryList");
if (recoveryList instanceof HTMLElement) {
  new MutationObserver(() => void syncRecoveryKey()).observe(recoveryList, { childList: true, subtree: true });
}
setInterval(syncProgress, 1000);
syncProgress();
