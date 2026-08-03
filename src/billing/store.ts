import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { billingSummary } from "./bill.js";
import type { BillingSummary, ChartBill } from "./types.js";

const billName = (id: string): string => `${id.replaceAll(/[^A-Za-z0-9_-]/gu, "_")}.json`;
const parseBill = (text: string): ChartBill | null => {
  try {
    const value = JSON.parse(text) as Partial<ChartBill>;
    return value.schema === "astral-bill/1.0.0" && typeof value.id === "string" ? value as ChartBill : null;
  } catch {
    return null;
  }
};

export class BillStore {
  readonly #dir: string;
  readonly #live = new Map<string, ChartBill>();

  constructor(dir: string) {
    if (dir.trim().length === 0) throw new Error("Billing directory is required");
    this.#dir = dir;
  }

  live(bill: ChartBill): void {
    this.#live.set(bill.id, bill);
  }

  removeLive(id: string): void {
    this.#live.delete(id);
  }

  liveBills(): ChartBill[] {
    return [...this.#live.values()].map((bill) => structuredClone(bill));
  }

  async save(bill: ChartBill): Promise<void> {
    await mkdir(this.#dir, { recursive: true });
    const path = join(this.#dir, billName(bill.id));
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(bill, null, 2)}\n`, "utf8");
    await rename(temporary, path);
    this.#live.delete(bill.id);
  }

  async get(id: string): Promise<ChartBill | null> {
    const live = this.#live.get(id);
    if (live !== undefined) return structuredClone(live);
    try {
      return parseBill(await readFile(join(this.#dir, billName(id)), "utf8"));
    } catch {
      return null;
    }
  }

  async list(): Promise<ChartBill[]> {
    let names: string[];
    try {
      names = await readdir(this.#dir);
    } catch {
      names = [];
    }
    const saved = await Promise.all(names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        try {
          return parseBill(await readFile(join(this.#dir, name), "utf8"));
        } catch {
          return null;
        }
      }));
    const merged = new Map<string, ChartBill>();
    for (const bill of saved) if (bill !== null) merged.set(bill.id, bill);
    for (const bill of this.#live.values()) merged.set(bill.id, structuredClone(bill));
    return [...merged.values()].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }

  async summary(): Promise<BillingSummary> {
    return billingSummary(await this.list());
  }
}
