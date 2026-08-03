export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export type UsagePurpose = "primary" | "audit_repair" | "completion_repair" | "truncation_repair";

export interface ResponseUsage {
  responseId: string | null;
  model: string;
  shape: string;
  clientId: string;
  conversationId: string | null;
  purpose: UsagePurpose;
  at: string;
  usage: TokenUsage;
}

export interface PricedUsage extends ResponseUsage {
  billId: string;
  lane: string;
  costUsd: number | null;
}

export interface UsageTotals extends TokenUsage {
  requests: number;
  costUsd: number | null;
}

export interface UsageGroup extends UsageTotals {
  key: string;
}

export interface PriceRate {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

export interface PriceCatalogue {
  id: string;
  currency: "USD";
  effectiveAt: string;
  source: string;
  models: Readonly<Record<string, PriceRate>>;
}

export type BillStatus = "running" | "completed" | "failed" | "stopped";

export interface ChartBill {
  schema: "astral-bill/1.0.0";
  id: string;
  calculationFingerprint: string;
  status: BillStatus;
  startedAt: string;
  endedAt: string | null;
  pricing: {
    catalogue: string;
    source: string;
    effectiveAt: string;
    currency: "USD";
    complete: boolean;
  };
  events: PricedUsage[];
  byModel: UsageGroup[];
  byLane: UsageGroup[];
  total: UsageTotals;
}

export interface BillingSummary {
  schema: "astral-billing-summary/1.0.0";
  bills: number;
  completedBills: number;
  failedBills: number;
  totalCostUsd: number;
  averageCompletedChartCostUsd: number | null;
  totalUsage: UsageTotals;
  byModel: UsageGroup[];
  latest: ChartBill[];
}
