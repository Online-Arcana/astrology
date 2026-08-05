const element = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

interface MaintenanceBaseline {
  startedAt: number;
  remainingAtStart: number | null;
  acceptedAtStart: number | null;
  seenProgress: boolean;
}

let baseline: MaintenanceBaseline | null = null;
let lastStartMessage = "";

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "Calculating…";
  if (seconds < 45) return "Less than a minute";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `About ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `About ${hours} hr` : `About ${hours} hr ${remainder} min`;
};

const readMaintenanceStart = (): void => {
  const message = element<HTMLElement>("#canonicaliseStatus")?.textContent ?? "";
  if (message === lastStartMessage) return;
  lastStartMessage = message;

  const partial = /Opening the full generation screen\. (\d+) missing or invalid interpretation unit/u.exec(message);
  if (partial !== null) {
    baseline = {
      startedAt: Date.now(),
      remainingAtStart: Number.parseInt(partial[1] ?? "0", 10),
      acceptedAtStart: null,
      seenProgress: false,
    };
    return;
  }
  if (/Opening the full generation screen\.[\s\S]*every required interpretation will be rebuilt/u.test(message)) {
    baseline = {
      startedAt: Date.now(),
      remainingAtStart: null,
      acceptedAtStart: 0,
      seenProgress: false,
    };
  }
};

const updateEta = (): void => {
  const selected = baseline;
  if (selected === null) return;

  const error = element<HTMLElement>("#errorCard");
  if (error !== null && !error.classList.contains("hidden")) {
    baseline = null;
    return;
  }

  const card = element<HTMLElement>("#progressCard");
  const visible = card !== null && !card.classList.contains("hidden");
  if (!visible) {
    if (selected.seenProgress) baseline = null;
    return;
  }
  selected.seenProgress = true;

  const progress = element<HTMLElement>("#progressNumbers")?.textContent ?? "";
  const values = /(\d+)\s+of\s+(\d+)/u.exec(progress);
  if (values === null) return;
  const completed = Number.parseInt(values[1] ?? "0", 10);
  const total = Number.parseInt(values[2] ?? "0", 10);
  if (total <= 0) return;

  if (selected.acceptedAtStart === null) {
    selected.acceptedAtStart = Math.max(0, total - (selected.remainingAtStart ?? total));
  }
  if (completed < selected.acceptedAtStart) return;

  const remaining = Math.max(0, total - completed);
  const output = element<HTMLElement>("#generationEta");
  if (output === null) return;
  if (remaining === 0) {
    output.textContent = "Complete";
    baseline = null;
    return;
  }

  const progressed = completed - selected.acceptedAtStart;
  const elapsedSeconds = (Date.now() - selected.startedAt) / 1000;
  const etaSeconds = progressed > 0
    ? elapsedSeconds / progressed * remaining
    : Number.NaN;
  output.textContent = formatDuration(etaSeconds);
};

const status = element<HTMLElement>("#canonicaliseStatus");
const progress = element<HTMLElement>("#progressNumbers");
const progressCard = element<HTMLElement>("#progressCard");
const errorCard = element<HTMLElement>("#errorCard");

if (status !== null) {
  new MutationObserver(() => {
    readMaintenanceStart();
    updateEta();
  }).observe(status, { childList: true, characterData: true, subtree: true });
}
for (const target of [progress, progressCard, errorCard]) {
  if (target === null) continue;
  const options = target === progress
    ? { childList: true, characterData: true, subtree: true }
    : { attributes: true, attributeFilter: ["class"] };
  new MutationObserver(updateEta).observe(target, options);
}
