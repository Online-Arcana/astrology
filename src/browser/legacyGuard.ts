import { browserVault, type BrowserSecretSnapshot } from "./vault.js";

const protectedKeys = new Set(["astral.openai-key", "astral.signing-key"]);
const originalGetItem = Storage.prototype.getItem;
const originalSetItem = Storage.prototype.setItem;
const originalRemoveItem = Storage.prototype.removeItem;
let captured: BrowserSecretSnapshot | null = browserVault.legacySnapshot();

if (captured !== null) {
  originalRemoveItem.call(localStorage, "astral.openai-key");
  originalRemoveItem.call(localStorage, "astral.signing-key");
}

/**
 * Older deployed builds stored credentials directly in localStorage. Their
 * values are captured for this page session once, removed from persistent
 * plaintext storage immediately, and exposed only to the migration control.
 */
Storage.prototype.getItem = function getItem(key: string): string | null {
  if (this === localStorage && protectedKeys.has(key)) return null;
  return originalGetItem.call(this, key);
};

/**
 * Some compatibility helpers still attempt to write the historical keys.
 * Ignore those writes so no current user action can reintroduce plaintext
 * credentials into persistent browser storage.
 */
Storage.prototype.setItem = function setItem(key: string, value: string): void {
  if (this === localStorage && protectedKeys.has(key)) return;
  originalSetItem.call(this, key, value);
};

Storage.prototype.removeItem = function removeItem(key: string): void {
  if (this === localStorage && protectedKeys.has(key)) return;
  originalRemoveItem.call(this, key);
};

Object.defineProperty(browserVault, "legacySnapshot", {
  configurable: false,
  enumerable: false,
  value: (): BrowserSecretSnapshot | null => captured,
  writable: false,
});

Object.defineProperty(browserVault, "clearLegacy", {
  configurable: false,
  enumerable: false,
  value: (): void => {
    captured = null;
  },
  writable: false,
});
