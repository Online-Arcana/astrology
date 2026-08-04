import type { PriceCatalogue, PriceRate, TokenUsage } from "./types.js";

export const openAiPriceCatalogue: PriceCatalogue = {
  id: "openai-standard-2026-08-04",
  currency: "USD",
  effectiveAt: "2026-08-04",
  source: "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
  models: {
    "gpt-5": {
      inputUsdPerMillion: 1.25,
      cachedInputUsdPerMillion: 0.125,
      outputUsdPerMillion: 10.00,
    },
    "gpt-5-mini": {
      inputUsdPerMillion: 0.25,
      cachedInputUsdPerMillion: 0.025,
      outputUsdPerMillion: 2.00,
    },
    "gpt-5-nano": {
      inputUsdPerMillion: 0.05,
      cachedInputUsdPerMillion: 0.005,
      outputUsdPerMillion: 0.40,
    },
    "gpt-5.4": {
      inputUsdPerMillion: 2.50,
      cachedInputUsdPerMillion: 0.25,
      outputUsdPerMillion: 15.00,
    },
    "gpt-5.4-mini": {
      inputUsdPerMillion: 0.75,
      cachedInputUsdPerMillion: 0.075,
      outputUsdPerMillion: 4.50,
    },
    "gpt-5.4-nano": {
      inputUsdPerMillion: 0.20,
      cachedInputUsdPerMillion: 0.020,
      outputUsdPerMillion: 1.25,
    },
    "gpt-5.6-luna": {
      inputUsdPerMillion: 0.20,
      cachedInputUsdPerMillion: 0.020,
      outputUsdPerMillion: 1.20,
    },
  },
};

const modelRoot = (model: string, catalogue: PriceCatalogue): string | null => {
  const matches = Object.keys(catalogue.models)
    .filter((key) => model === key || model.startsWith(`${key}-`))
    .sort((left, right) => right.length - left.length);
  return matches[0] ?? null;
};

export const rateFor = (
  model: string,
  catalogue: PriceCatalogue = openAiPriceCatalogue,
): PriceRate | null => {
  const root = modelRoot(model, catalogue);
  return root === null ? null : catalogue.models[root] ?? null;
};

export const priceUsage = (
  model: string,
  usage: TokenUsage,
  catalogue: PriceCatalogue = openAiPriceCatalogue,
): number | null => {
  const rate = rateFor(model, catalogue);
  if (rate === null) return null;
  const cached = Math.min(usage.inputTokens, usage.cachedInputTokens);
  const uncached = Math.max(0, usage.inputTokens - cached);
  return (
    uncached * rate.inputUsdPerMillion
    + cached * rate.cachedInputUsdPerMillion
    + usage.outputTokens * rate.outputUsdPerMillion
  ) / 1_000_000;
};
