import { openAiPriceCatalogue, priceUsage } from "./pricing.js";
import type {
  BillStatus,
  BillingSummary,
  ChartBill,
  PricedUsage,
  ResponseUsage,
  TokenUsage,
  UsageGroup,
  UsageTotals,
} from "./types.js";

const zero = (): UsageTotals => ({
  requests: 0,
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  totalTokens: 0,
  costUsd: 0,
});

const add = (target: UsageTotals, usage: TokenUsage, cost: number | null): void => {
  target.requests += 1;
  target.inputTokens += usage.inputTokens;
  target.cachedInputTokens += usage.cachedInputTokens;
  target.outputTokens += usage.outputTokens;
  target.reasoningTokens += usage.reasoningTokens;
  target.totalTokens += usage.totalTokens;
  target.costUsd = target.costUsd === null || cost === null ? null : target.costUsd + cost;
};

const groups = (events: readonly PricedUsage[], key: "model" | "lane"): UsageGroup[] => {
  const values = new Map<string, UsageTotals>();
  for (const event of events) {
    const name = event[key];
    const total = values.get(name) ?? zero();
    add(total, event.usage, event.costUsd);
    values.set(name, total);
  }
  return [...values.entries()]
    .map(([name, total]) => ({ key: name, ...total }))
    .sort((left, right) => right.totalTokens - left.totalTokens || left.key.localeCompare(right.key, "en"));
};

const totals = (events: readonly PricedUsage[]): UsageTotals => {
  const result = zero();
  for (const event of events) add(result, event.usage, event.costUsd);
  return result;
};

const copy = (bill: ChartBill): ChartBill => JSON.parse(JSON.stringify(bill)) as ChartBill;

export class BillCollector {
  readonly #id: string;
  readonly #fingerprint: string;
  readonly #startedAt: string;
  readonly #events: PricedUsage[];
  #status: BillStatus;
  #endedAt: string | null;

  constructor(
    calculationFingerprint: string,
    previous: ChartBill | null = null,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.#id = previous?.id ?? globalThis.crypto.randomUUID();
    this.#fingerprint = calculationFingerprint;
    this.#startedAt = previous?.startedAt ?? now();
    this.#events = previous?.events.map((event) => ({ ...event, usage: { ...event.usage } })) ?? [];
    this.#status = "running";
    this.#endedAt = null;
  }

  add(event: ResponseUsage): PricedUsage {
    const priced: PricedUsage = {
      ...event,
      billId: this.#id,
      lane: event.clientId,
      costUsd: priceUsage(event.model, event.usage),
    };
    this.#events.push(priced);
    return priced;
  }

  finish(status: Exclude<BillStatus, "running">, at = new Date().toISOString()): ChartBill {
    this.#status = status;
    this.#endedAt = at;
    return this.snapshot();
  }

  snapshot(): ChartBill {
    const events = this.#events.map((event) => ({ ...event, usage: { ...event.usage } }));
    const complete = events.every(({ costUsd }) => costUsd !== null);
    return {
      schema: "astral-bill/1.0.0",
      id: this.#id,
      calculationFingerprint: this.#fingerprint,
      status: this.#status,
      startedAt: this.#startedAt,
      endedAt: this.#endedAt,
      pricing: {
        catalogue: openAiPriceCatalogue.id,
        source: openAiPriceCatalogue.source,
        effectiveAt: openAiPriceCatalogue.effectiveAt,
        currency: openAiPriceCatalogue.currency,
        complete,
      },
      events,
      byModel: groups(events, "model"),
      byLane: groups(events, "lane"),
      total: totals(events),
    };
  }
}

export const billingSummary = (values: readonly ChartBill[], latest = 10): BillingSummary => {
  const bills = values.map(copy);
  const completed = bills.filter(({ status }) => status === "completed");
  const allEvents = bills.flatMap(({ events }) => events);
  const total = totals(allEvents);
  const pricedCompleted = completed.filter(({ total: value }) => value.costUsd !== null);
  const completedCost = pricedCompleted.reduce((sum, { total: value }) => sum + (value.costUsd ?? 0), 0);
  return {
    schema: "astral-billing-summary/1.0.0",
    bills: bills.length,
    completedBills: completed.length,
    failedBills: bills.filter(({ status }) => status === "failed").length,
    totalCostUsd: total.costUsd ?? 0,
    averageCompletedChartCostUsd: pricedCompleted.length === 0 ? null : completedCost / pricedCompleted.length,
    totalUsage: total,
    byModel: groups(allEvents, "model"),
    latest: bills
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, latest),
  };
};
