import type { ChartBill } from "../billing/types.js";
import type { ChartGenerationCheckpoint } from "../generate/service.js";
import type { AstralFile } from "../types/file.js";

export interface BrowserJob {
  id: string;
  status: "running" | "stopped" | "failed";
  createdAt: string;
  updatedAt: string;
  request: unknown;
  checkpoint: ChartGenerationCheckpoint;
  error: string | null;
}

export interface BrowserChart {
  id: string;
  createdAt: string;
  file: AstralFile;
  bill: ChartBill | null;
}

type StoreName = "jobs" | "charts" | "bills";

const databaseName = "astral-browser";
const databaseVersion = 1;

const requestResult = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.addEventListener("success", () => resolve(request.result), { once: true });
  request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB request failed")), { once: true });
});

const transactionDone = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.addEventListener("complete", () => resolve(), { once: true });
  transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")), { once: true });
  transaction.addEventListener("error", () => reject(transaction.error ?? new Error("IndexedDB transaction failed")), { once: true });
});

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, databaseVersion);
  request.addEventListener("upgradeneeded", () => {
    const database = request.result;
    if (!database.objectStoreNames.contains("jobs")) database.createObjectStore("jobs", { keyPath: "id" });
    if (!database.objectStoreNames.contains("charts")) database.createObjectStore("charts", { keyPath: "id" });
    if (!database.objectStoreNames.contains("bills")) database.createObjectStore("bills", { keyPath: "id" });
  });
  request.addEventListener("success", () => resolve(request.result), { once: true });
  request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB could not be opened")), { once: true });
});

export class BrowserStore {
  readonly #database: Promise<IDBDatabase>;

  constructor() {
    this.#database = openDatabase();
  }

  async put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
    const database = await this.#database;
    const transaction = database.transaction(store, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(store).put(structuredClone(value));
    await done;
  }

  async get<T>(store: StoreName, id: string): Promise<T | null> {
    const database = await this.#database;
    const transaction = database.transaction(store, "readonly");
    const done = transactionDone(transaction);
    const value = await requestResult(transaction.objectStore(store).get(id));
    await done;
    return value === undefined ? null : value as T;
  }

  async all<T>(store: StoreName): Promise<T[]> {
    const database = await this.#database;
    const transaction = database.transaction(store, "readonly");
    const done = transactionDone(transaction);
    const values = await requestResult(transaction.objectStore(store).getAll());
    await done;
    return values as T[];
  }

  async delete(store: StoreName, id: string): Promise<void> {
    const database = await this.#database;
    const transaction = database.transaction(store, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(store).delete(id);
    await done;
  }

  jobs(): Promise<BrowserJob[]> {
    return this.all<BrowserJob>("jobs");
  }

  charts(): Promise<BrowserChart[]> {
    return this.all<BrowserChart>("charts");
  }

  bills(): Promise<ChartBill[]> {
    return this.all<ChartBill>("bills");
  }
}
