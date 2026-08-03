const signingStorageKey = "astral.signing-key";
const openAiStorageKey = "astral.openai-key";
const formStorageKey = "astral.chart-form";
const svgNamespace = "http://www.w3.org/2000/svg";

const icon = (kind) => {
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
  if (kind === "open") {
    svg.innerHTML = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle>';
    return svg;
  }
  svg.innerHTML = '<path d="m3 3 18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-2 3.1"></path><path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8a10.7 10.7 0 0 0 5.4-1.4"></path>';
  return svg;
};

const signingInput = document.querySelector("#signingKey");

if (signingInput instanceof HTMLInputElement && document.querySelector("#copySigningKeyBundle") === null) {
  const label = signingInput.closest("label");
  const saveButton = document.querySelector("#saveSigningKey");
  const generateButton = document.querySelector("#generateSigningKey");

  let field = signingInput.parentElement;
  if (!(field instanceof HTMLElement) || !field.classList.contains("password-field")) {
    field = document.createElement("span");
    field.className = "password-field";
    signingInput.before(field);
    field.append(signingInput);
  }

  let show = document.querySelector("#showSigningKeyBundle");
  if (!(show instanceof HTMLButtonElement)) {
    show = document.createElement("button");
    show.id = "showSigningKeyBundle";
    show.type = "button";
    show.className = "password-toggle";
    field.append(show);
  }

  const openEye = icon("open");
  const closedEye = icon("closed");
  show.replaceChildren(closedEye, openEye);

  const syncVisibility = () => {
    const visible = signingInput.type === "text";
    openEye.hidden = !visible;
    closedEye.hidden = visible;
    show.setAttribute("aria-pressed", String(visible));
    show.setAttribute("aria-label", visible ? "Hide signing key bundle" : "Show signing key bundle");
    show.title = visible ? "Hide signing key bundle" : "Show signing key bundle";
  };
  syncVisibility();

  const controls = document.createElement("div");
  controls.className = "actions signing-key-actions";

  const status = document.createElement("p");
  status.id = "signingKeyExportStatus";
  status.className = "muted";
  status.textContent = "Back up this bundle. You need it to sign again after clearing site data or moving to another browser.";

  const action = (id, labelText) => {
    const control = document.createElement("button");
    control.id = id;
    control.type = "button";
    control.className = "ghost";
    control.textContent = labelText;
    controls.append(control);
    return control;
  };

  const copy = action("copySigningKeyBundle", "Copy bundle");
  const download = action("downloadSigningKeyBundle", "Download bundle");
  const importButton = action("importSigningKeyBundle", "Import bundle");

  const importInput = document.createElement("input");
  importInput.id = "signingKeyBundleFile";
  importInput.type = "file";
  importInput.accept = ".json,application/json";
  importInput.hidden = true;
  controls.append(importInput);

  const setStatus = (message, warning = false) => {
    status.textContent = message;
    status.className = warning ? "notice warning" : "muted";
  };

  const parseBundle = (raw) => {
    let value;
    try {
      value = JSON.parse(raw);
    } catch (cause) {
      throw new Error("The signing key bundle is not valid JSON", { cause });
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("The signing key bundle must be a JSON object");
    }
    const issuer = typeof value.issuer === "string" ? value.issuer.trim() : "";
    const privatePkcs8 = typeof value.privatePkcs8 === "string" ? value.privatePkcs8.trim() : "";
    const publicRaw = typeof value.publicRaw === "string" ? value.publicRaw.trim() : "";
    if (issuer.length === 0 || privatePkcs8.length === 0 || publicRaw.length === 0) {
      throw new Error("The bundle must contain issuer, privatePkcs8 and publicRaw");
    }
    return JSON.stringify({ issuer, privatePkcs8, publicRaw }, null, 2);
  };

  const bundleText = () => {
    const entered = signingInput.value.trim();
    const stored = localStorage.getItem(signingStorageKey)?.trim() ?? "";
    const selected = entered.length > 0 ? entered : stored;
    if (selected.length === 0) throw new Error("Generate or import a signing key before exporting it");
    return parseBundle(selected);
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
    const copied = document.execCommand("copy");
    temporary.remove();
    if (!copied) throw new Error("The browser did not allow clipboard access");
  };

  const safeIssuer = (bundle) => {
    const value = JSON.parse(bundle).issuer;
    return String(value).replaceAll(/[^A-Za-z0-9._-]+/g, "-").replaceAll(/^-+|-+$/g, "") || "astral";
  };

  show.addEventListener("click", () => {
    signingInput.type = signingInput.type === "text" ? "password" : "text";
    syncVisibility();
  });

  copy.addEventListener("click", () => void (async () => {
    const bundle = bundleText();
    await copyText(bundle);
    setStatus("Signing key bundle copied. Store it somewhere private.");
  })().catch((cause) => setStatus(cause instanceof Error ? cause.message : String(cause), true)));

  download.addEventListener("click", () => {
    try {
      const bundle = bundleText();
      const url = URL.createObjectURL(new Blob([`${bundle}\n`], { type: "application/json;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeIssuer(bundle)}-signing-key.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus("Signing key bundle downloaded. Keep the file private and backed up.");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause), true);
    }
  });

  importButton.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", () => void (async () => {
    const file = importInput.files?.[0];
    if (file === undefined) return;
    const bundle = parseBundle(await file.text());
    signingInput.value = bundle;
    if (saveButton instanceof HTMLButtonElement) saveButton.click();
    setStatus("Bundle loaded. The page is validating and saving it locally.");
    importInput.value = "";
  })().catch((cause) => setStatus(cause instanceof Error ? cause.message : String(cause), true)));

  if (generateButton instanceof HTMLButtonElement) {
    generateButton.addEventListener("click", () => {
      const previous = localStorage.getItem(signingStorageKey);
      setStatus("Generating a new signing key bundle…");
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        const current = localStorage.getItem(signingStorageKey);
        if (current !== null && current !== previous) {
          clearInterval(timer);
          setStatus("New key generated and saved locally. Download a backup now so you can sign again later.");
          return;
        }
        if (attempts >= 50) clearInterval(timer);
      }, 100);
    });
  }

  if (saveButton instanceof HTMLButtonElement) {
    saveButton.addEventListener("click", () => setStatus("Validating and saving the signing key bundle locally…"));
  }

  if (label !== null) {
    label.append(controls, status);
  } else {
    field.insertAdjacentElement("afterend", controls);
    controls.insertAdjacentElement("afterend", status);
  }
}

const form = document.querySelector("#chartForm");
const openAiInput = document.querySelector("#openAiKey");
const saveOpenAiButton = document.querySelector("#saveOpenAiKey");
const timeInput = document.querySelector("#time");

if (saveOpenAiButton instanceof HTMLButtonElement) {
  saveOpenAiButton.hidden = true;
  saveOpenAiButton.tabIndex = -1;
  saveOpenAiButton.setAttribute("aria-hidden", "true");
}

if (timeInput instanceof HTMLInputElement) timeInput.step = "60";

if (form instanceof HTMLFormElement) {
  let restoring = false;
  let saveTimer = 0;

  const controls = () => [...form.querySelectorAll("input[id], select[id], textarea[id]")]
    .filter((control) => !(control instanceof HTMLInputElement) || control.type !== "file");

  const selectedCity = () => {
    const city = document.querySelector("#city");
    if (!(city instanceof HTMLSelectElement)) return null;
    const raw = city.selectedOptions[0]?.dataset.item;
    if (raw === undefined) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const saveDraft = () => {
    if (restoring) return;
    const fields = {};
    for (const control of controls()) fields[control.id] = control.value;
    try {
      localStorage.setItem(formStorageKey, JSON.stringify({
        schema: "astral-chart-form/1.0.0",
        fields,
        city: selectedCity(),
      }));
    } catch {
      // The form remains usable when browser storage is unavailable.
    }
  };

  const queueSave = () => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraft, 80);
  };

  const loadDraft = () => {
    const raw = localStorage.getItem(formStorageKey);
    if (raw === null) return null;
    try {
      const value = JSON.parse(raw);
      if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
      if (typeof value.fields !== "object" || value.fields === null || Array.isArray(value.fields)) return null;
      return value;
    } catch {
      return null;
    }
  };

  const waitFor = async (ready, timeout = 10000) => {
    const started = Date.now();
    while (!ready()) {
      if (Date.now() - started >= timeout) return false;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return true;
  };

  const optionExists = (select, value) => [...select.options].some((option) => option.value === value);
  const change = (control) => control.dispatchEvent(new Event("change", { bubbles: true }));

  const restoreSelect = async (id, value) => {
    if (typeof value !== "string" || value.length === 0) return false;
    const select = document.querySelector(`#${id}`);
    if (!(select instanceof HTMLSelectElement)) return false;
    const available = await waitFor(() => optionExists(select, value));
    if (!available) return false;
    select.value = value;
    change(select);
    return true;
  };

  const cityLabel = (city) => {
    const region = typeof city.region?.name === "string" ? `, ${city.region.name}` : "";
    const zone = typeof city.timeZone === "string" && city.timeZone.length > 0 ? city.timeZone : "timezone unavailable";
    return `${String(city.name ?? "Saved city")}${region} · ${zone}`;
  };

  const restoreDraft = async () => {
    const draft = loadDraft();
    if (draft === null) return;
    restoring = true;
    try {
      const hierarchy = new Set(["continent", "country", "region", "city"]);
      for (const [id, value] of Object.entries(draft.fields)) {
        if (hierarchy.has(id) || typeof value !== "string") continue;
        const control = document.querySelector(`#${CSS.escape(id)}`);
        if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
          control.value = value;
        }
      }

      const accuracy = document.querySelector("#timeAccuracy");
      if (accuracy instanceof HTMLSelectElement) change(accuracy);
      const zodiac = document.querySelector("#zodiac");
      if (zodiac instanceof HTMLSelectElement) change(zodiac);

      const continentRestored = await restoreSelect("continent", draft.fields.continent);
      if (!continentRestored) return;
      const countryRestored = await restoreSelect("country", draft.fields.country);
      if (!countryRestored) return;

      const regionValue = typeof draft.fields.region === "string" ? draft.fields.region : "";
      if (regionValue.length > 0) await restoreSelect("region", regionValue);
      else {
        const region = document.querySelector("#region");
        if (region instanceof HTMLSelectElement) await waitFor(() => !region.disabled);
      }

      const city = draft.city;
      const citySelect = document.querySelector("#city");
      if (citySelect instanceof HTMLSelectElement && typeof city === "object" && city !== null && typeof city.id === "string") {
        const empty = new Option("Search and choose a city", "");
        const saved = new Option(cityLabel(city), city.id);
        saved.dataset.item = JSON.stringify(city);
        citySelect.replaceChildren(empty, saved);
        citySelect.disabled = false;
        citySelect.value = city.id;
        change(citySelect);
      }
    } finally {
      restoring = false;
      saveDraft();
    }
  };

  form.addEventListener("input", queueSave);
  form.addEventListener("change", queueSave);

  document.addEventListener("submit", (event) => {
    if (event.target !== form) return;
    if (timeInput instanceof HTMLInputElement && /^\d{2}:\d{2}$/u.test(timeInput.value)) {
      timeInput.value = `${timeInput.value}:00`;
    }
    if (openAiInput instanceof HTMLInputElement) {
      const key = openAiInput.value.trim();
      if (key.length === 0) localStorage.removeItem(openAiStorageKey);
      else localStorage.setItem(openAiStorageKey, key);
    }
    saveDraft();
  }, true);

  void restoreDraft();
}
