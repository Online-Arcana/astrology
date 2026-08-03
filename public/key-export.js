const signingStorageKey = "astral.signing-key";
const input = document.querySelector("#signingKey");

if (input instanceof HTMLInputElement && document.querySelector("#copySigningKeyBundle") === null) {
  const label = input.closest("label");
  const saveButton = document.querySelector("#saveSigningKey");
  const generateButton = document.querySelector("#generateSigningKey");

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

  const show = action("showSigningKeyBundle", "Show bundle");
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
    const entered = input.value.trim();
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
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    show.textContent = visible ? "Show bundle" : "Hide bundle";
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
    input.value = bundle;
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
    input.insertAdjacentElement("afterend", controls);
    controls.insertAdjacentElement("afterend", status);
  }
}
