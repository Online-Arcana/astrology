const formStorageKey = "astral.chart-form";

const form = document.querySelector<HTMLFormElement>("#chartForm");
const timeInput = document.querySelector<HTMLInputElement>("#time");
const saveOpenAiButton = document.querySelector<HTMLButtonElement>("#saveOpenAiKey");

if (saveOpenAiButton !== null) {
  saveOpenAiButton.hidden = true;
  saveOpenAiButton.tabIndex = -1;
  saveOpenAiButton.setAttribute("aria-hidden", "true");
}

if (timeInput !== null) timeInput.step = "60";

interface FormDraft {
  schema: "astral-chart-form/1.0.0";
  fields: Record<string, string>;
  city: unknown;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const draftFrom = (value: unknown): FormDraft | null => {
  if (!record(value) || value["schema"] !== "astral-chart-form/1.0.0") return null;
  const fields = value["fields"];
  if (!record(fields) || !Object.values(fields).every((item) => typeof item === "string")) return null;
  return {
    schema: "astral-chart-form/1.0.0",
    fields: fields as Record<string, string>,
    city: value["city"],
  };
};

if (form !== null) {
  let restoring = false;
  let saveTimer = 0;

  const controls = (): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> =>
    [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input[id], select[id], textarea[id]")]
      .filter((control) => !(control instanceof HTMLInputElement) || control.type !== "file");

  const selectedCity = (): unknown => {
    const city = document.querySelector<HTMLSelectElement>("#city");
    const raw = city?.selectedOptions[0]?.dataset["item"];
    if (raw === undefined) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  };

  const saveDraft = (): void => {
    if (restoring) return;
    const fields: Record<string, string> = {};
    for (const control of controls()) fields[control.id] = control.value;
    const draft: FormDraft = {
      schema: "astral-chart-form/1.0.0",
      fields,
      city: selectedCity(),
    };
    try {
      localStorage.setItem(formStorageKey, JSON.stringify(draft));
    } catch {
      // The form remains usable when localStorage is unavailable.
    }
  };

  const queueSave = (): void => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraft, 80);
  };

  const loadDraft = (): FormDraft | null => {
    try {
      const raw = localStorage.getItem(formStorageKey);
      return raw === null ? null : draftFrom(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  };

  const waitFor = async (ready: () => boolean, timeout = 10_000): Promise<boolean> => {
    const started = Date.now();
    while (!ready()) {
      if (Date.now() - started >= timeout) return false;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return true;
  };

  const optionExists = (select: HTMLSelectElement, value: string): boolean =>
    [...select.options].some((option) => option.value === value);

  const change = (control: HTMLInputElement | HTMLSelectElement): void => {
    control.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const restoreSelect = async (id: string, value: string | undefined): Promise<boolean> => {
    if (value === undefined || value.length === 0) return false;
    const select = document.querySelector<HTMLSelectElement>(`#${CSS.escape(id)}`);
    if (select === null) return false;
    const available = await waitFor(() => optionExists(select, value));
    if (!available) return false;
    select.value = value;
    change(select);
    return true;
  };

  const cityLabel = (city: Record<string, unknown>): string => {
    const regionValue = city["region"];
    const regionName = record(regionValue) && typeof regionValue["name"] === "string"
      ? regionValue["name"]
      : null;
    const zoneValue = city["timeZone"];
    const zone = typeof zoneValue === "string" && zoneValue.length > 0
      ? zoneValue
      : "timezone unavailable";
    return `${String(city["name"] ?? "Saved city")}${regionName === null ? "" : `, ${regionName}`} · ${zone}`;
  };

  const restoreDraft = async (): Promise<void> => {
    const draft = loadDraft();
    if (draft === null) return;
    restoring = true;
    try {
      const hierarchy = new Set(["continent", "country", "region", "city"]);
      for (const [id, value] of Object.entries(draft.fields)) {
        if (hierarchy.has(id)) continue;
        const control = document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`#${CSS.escape(id)}`);
        if (control !== null) control.value = value;
      }

      const accuracy = document.querySelector<HTMLSelectElement>("#timeAccuracy");
      if (accuracy !== null) change(accuracy);
      const zodiac = document.querySelector<HTMLSelectElement>("#zodiac");
      if (zodiac !== null) change(zodiac);

      if (!await restoreSelect("continent", draft.fields["continent"])) return;
      if (!await restoreSelect("country", draft.fields["country"])) return;
      const regionValue = draft.fields["region"] ?? "";
      if (regionValue.length > 0) await restoreSelect("region", regionValue);
      else {
        const region = document.querySelector<HTMLSelectElement>("#region");
        if (region !== null) await waitFor(() => !region.disabled);
      }

      const city = draft.city;
      const citySelect = document.querySelector<HTMLSelectElement>("#city");
      if (citySelect === null || !record(city)) return;
      const cityId = city["id"];
      if (typeof cityId !== "string") return;
      const empty = new Option("Search and choose a city", "");
      const saved = new Option(cityLabel(city), cityId);
      saved.dataset["item"] = JSON.stringify(city);
      citySelect.replaceChildren(empty, saved);
      citySelect.disabled = false;
      citySelect.value = cityId;
      change(citySelect);
    } finally {
      restoring = false;
      saveDraft();
    }
  };

  form.addEventListener("input", queueSave);
  form.addEventListener("change", queueSave);
  document.addEventListener("submit", (event) => {
    if (event.target !== form) return;
    if (timeInput !== null && /^\d{2}:\d{2}$/u.test(timeInput.value)) {
      timeInput.value = `${timeInput.value}:00`;
    }
    saveDraft();
  }, true);

  void restoreDraft();
}
