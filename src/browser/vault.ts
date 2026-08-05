import { base64url, ownedBuffer, unbase64url } from "../file/codec.js";

const databaseName = "astral-secure-vault";
const databaseVersion = 1;
const storeName = "vault";
const recordId = "credentials";
const legacyOpenAiStorageKey = "astral.openai-key";
const legacySigningStorageKey = "astral.signing-key";
const vaultSchema = "astral-browser-vault/1.0.0" as const;
const aad = new TextEncoder().encode(vaultSchema);

export interface BrowserSecretSnapshot {
  openAiKey: string;
  signingKeyText: string | null;
  /** Passwords are indexed by the SHA-256 of reconstructed canonical chart JSON. */
  packagePasswords?: Record<string, string>;
}

interface VaultRecord {
  id: typeof recordId;
  schema: typeof vaultSchema;
  credentialId: string;
  prfSalt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
  updatedAt: string;
}

interface PrfResults {
  prf?: {
    enabled?: boolean;
    results?: {
      first?: ArrayBuffer;
    };
  };
}

const random = (length: number): Uint8Array => crypto.getRandomValues(new Uint8Array(length));

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const packagePasswords = (value: unknown): Record<string, string> => {
  if (!record(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, password]) =>
    /^sha256:[a-f0-9]{64}$/u.test(id)
    && typeof password === "string"
    && password.length > 0)) as Record<string, string>;
};

const selectedSnapshot = (snapshot: BrowserSecretSnapshot): BrowserSecretSnapshot => ({
  openAiKey: snapshot.openAiKey,
  signingKeyText: snapshot.signingKeyText,
  packagePasswords: packagePasswords(snapshot.packagePasswords),
});

const requestValue = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.addEventListener("success", () => resolve(request.result), { once: true });
  request.addEventListener("error", () => reject(request.error ?? new Error("Browser vault request failed")), { once: true });
});

const transactionDone = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.addEventListener("complete", () => resolve(), { once: true });
  transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("Browser vault transaction aborted")), { once: true });
  transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Browser vault transaction failed")), { once: true });
});

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, databaseVersion);
  request.addEventListener("upgradeneeded", () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName, { keyPath: "id" });
  }, { once: true });
  request.addEventListener("success", () => resolve(request.result), { once: true });
  request.addEventListener("error", () => reject(request.error ?? new Error("Could not open the encrypted browser vault")), { once: true });
});

const parseVaultRecord = (value: unknown): VaultRecord | null => {
  if (!record(value)) return null;
  if (value["id"] !== recordId || value["schema"] !== vaultSchema) return null;
  for (const key of ["credentialId", "prfSalt", "iv", "ciphertext", "createdAt", "updatedAt"] as const) {
    if (typeof value[key] !== "string" || value[key].length === 0) return null;
  }
  return value as unknown as VaultRecord;
};

const readRecord = async (): Promise<VaultRecord | null> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readonly");
    return parseVaultRecord(await requestValue(transaction.objectStore(storeName).get(recordId)));
  } finally {
    database.close();
  }
};

const writeRecord = async (value: VaultRecord): Promise<void> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
};

const deleteRecord = async (): Promise<void> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(recordId);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
};

const prfOutput = (credential: PublicKeyCredential): Uint8Array | null => {
  const extensions = credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & PrfResults;
  const first = extensions.prf?.results?.first;
  return first === undefined ? null : new Uint8Array(first);
};

const getPrf = async (credentialId: Uint8Array, salt: Uint8Array): Promise<Uint8Array> => {
  const options = {
    challenge: random(32),
    allowCredentials: [{ id: credentialId, type: "public-key" as const }],
    userVerification: "required" as const,
    timeout: 120_000,
    extensions: { prf: { eval: { first: salt } } },
  } as unknown as PublicKeyCredentialRequestOptions;
  const selected = await navigator.credentials.get({ publicKey: options });
  if (!(selected instanceof PublicKeyCredential)) throw new Error("The browser did not return a passkey credential");
  const output = prfOutput(selected);
  if (output === null || output.byteLength !== 32) {
    throw new Error("This browser or authenticator did not provide a WebAuthn PRF secret");
  }
  return output;
};

const createCredential = async (salt: Uint8Array): Promise<{ credentialId: Uint8Array; secret: Uint8Array }> => {
  const userId = random(32);
  const options = {
    challenge: random(32),
    rp: { name: "Astrology chart creator" },
    user: {
      id: userId,
      name: `local-vault-${base64url(userId).slice(0, 16)}`,
      displayName: "Astrology local credential vault",
    },
    pubKeyCredParams: [
      { type: "public-key" as const, alg: -7 },
      { type: "public-key" as const, alg: -257 },
    ],
    authenticatorSelection: {
      residentKey: "required" as const,
      requireResidentKey: true,
      userVerification: "required" as const,
    },
    timeout: 120_000,
    attestation: "none" as const,
    extensions: { prf: { eval: { first: salt } } },
  } as unknown as PublicKeyCredentialCreationOptions;
  const created = await navigator.credentials.create({ publicKey: options });
  if (!(created instanceof PublicKeyCredential)) throw new Error("The browser did not create a passkey credential");
  const credentialId = new Uint8Array(created.rawId);
  const direct = prfOutput(created);
  return {
    credentialId,
    secret: direct !== null && direct.byteLength === 32
      ? direct
      : await getPrf(credentialId, salt),
  };
};

const aesKey = (secret: Uint8Array): Promise<CryptoKey> => crypto.subtle.importKey(
  "raw",
  ownedBuffer(secret),
  { name: "AES-GCM" },
  false,
  ["encrypt", "decrypt"],
);

const encrypt = async (
  key: CryptoKey,
  snapshot: BrowserSecretSnapshot,
): Promise<{ iv: string; ciphertext: string }> => {
  const iv = random(12);
  const plaintext = new TextEncoder().encode(JSON.stringify(selectedSnapshot(snapshot)));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ownedBuffer(iv), additionalData: ownedBuffer(aad), tagLength: 128 },
    key,
    ownedBuffer(plaintext),
  );
  return { iv: base64url(iv), ciphertext: base64url(new Uint8Array(encrypted)) };
};

const decrypt = async (key: CryptoKey, value: VaultRecord): Promise<BrowserSecretSnapshot> => {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ownedBuffer(unbase64url(value.iv)),
      additionalData: ownedBuffer(aad),
      tagLength: 128,
    },
    key,
    ownedBuffer(unbase64url(value.ciphertext)),
  );
  const parsed: unknown = JSON.parse(new TextDecoder().decode(decrypted));
  if (!record(parsed)) throw new Error("The decrypted browser vault is malformed");
  const openAiKey = typeof parsed["openAiKey"] === "string" ? parsed["openAiKey"] : "";
  const signingKeyText = parsed["signingKeyText"];
  if (signingKeyText !== null && typeof signingKeyText !== "string") {
    throw new Error("The decrypted signing key is malformed");
  }
  return {
    openAiKey,
    signingKeyText,
    packagePasswords: packagePasswords(parsed["packagePasswords"]),
  };
};

const ensureSupport = (): void => {
  if (!globalThis.isSecureContext) throw new Error("Secure credential storage requires HTTPS");
  if (!("PublicKeyCredential" in globalThis) || navigator.credentials === undefined) {
    throw new Error("This browser does not support WebAuthn passkeys");
  }
  if (!("indexedDB" in globalThis)) throw new Error("This browser does not support encrypted IndexedDB storage");
};

class BrowserVault {
  #key: CryptoKey | null = null;
  #record: VaultRecord | null = null;
  #writes: Promise<void> = Promise.resolve();

  get unlocked(): boolean {
    return this.#key !== null && this.#record !== null;
  }

  async exists(): Promise<boolean> {
    ensureSupport();
    return await readRecord() !== null;
  }

  legacySnapshot(): BrowserSecretSnapshot | null {
    const openAiKey = localStorage.getItem(legacyOpenAiStorageKey)?.trim() ?? "";
    const signingKeyText = localStorage.getItem(legacySigningStorageKey)?.trim() ?? null;
    return openAiKey.length === 0 && signingKeyText === null
      ? null
      : { openAiKey, signingKeyText, packagePasswords: {} };
  }

  clearLegacy(): void {
    localStorage.removeItem(legacyOpenAiStorageKey);
    localStorage.removeItem(legacySigningStorageKey);
  }

  async create(snapshot: BrowserSecretSnapshot): Promise<void> {
    ensureSupport();
    if (await readRecord() !== null) throw new Error("An encrypted browser vault already exists");
    const salt = random(32);
    const created = await createCredential(salt);
    const key = await aesKey(created.secret);
    const encrypted = await encrypt(key, snapshot);
    const timestamp = new Date().toISOString();
    const value: VaultRecord = {
      id: recordId,
      schema: vaultSchema,
      credentialId: base64url(created.credentialId),
      prfSalt: base64url(salt),
      ...encrypted,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await writeRecord(value);
    this.#key = key;
    this.#record = value;
    this.#writes = Promise.resolve();
    this.clearLegacy();
  }

  async unlock(): Promise<BrowserSecretSnapshot> {
    ensureSupport();
    const value = await readRecord();
    if (value === null) throw new Error("No encrypted browser vault exists yet");
    const secret = await getPrf(unbase64url(value.credentialId), unbase64url(value.prfSalt));
    const key = await aesKey(secret);
    const snapshot = await decrypt(key, value);
    this.#key = key;
    this.#record = value;
    this.#writes = Promise.resolve();
    return snapshot;
  }

  save(snapshot: BrowserSecretSnapshot): Promise<void> {
    const key = this.#key;
    if (key === null || this.#record === null) return Promise.resolve();
    const selected = selectedSnapshot(snapshot);
    const pending = this.#writes.then(async () => {
      const current = this.#record;
      if (current === null) return;
      const encrypted = await encrypt(key, selected);
      const value: VaultRecord = {
        ...current,
        ...encrypted,
        updatedAt: new Date().toISOString(),
      };
      await writeRecord(value);
      this.#record = value;
    });
    this.#writes = pending.catch(() => undefined);
    return pending;
  }

  lock(): void {
    this.#key = null;
    this.#record = null;
  }

  async remove(): Promise<void> {
    await this.#writes;
    await deleteRecord();
    this.lock();
    this.#writes = Promise.resolve();
  }
}

export const browserVault = new BrowserVault();
