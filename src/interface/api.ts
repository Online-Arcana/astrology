import { fetchOpenAICosts } from "../billing/openaiCosts.js";
import { openAiPriceCatalogue } from "../billing/pricing.js";
import type { BillStore } from "../billing/store.js";
import type { ChartBill } from "../billing/types.js";
import { CalculationUnavailableError, type CalculationOptions, type CalculationService } from "../calculate/service.js";
import { validateAstralFile } from "../file/validate.js";
import type { ChartGenerationService } from "../generate/service.js";
import type { PlaceCatalogue } from "../place/model.js";
import type { TrustedAuthority } from "../types/file.js";
import { parseCalculationRequest } from "./request.js";

export interface ApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface ApiRuntime {
  service: Pick<CalculationService, "calculate">;
  generator: Pick<ChartGenerationService, "generate"> | null;
  options: CalculationOptions;
  places: PlaceCatalogue;
  version: string;
  /** Optional for backwards-compatible custom runtimes. */
  bills?: BillStore;
  /** Optional admin credential used only by the provider-cost endpoint. */
  openAiAdminKey?: string | null;
}

const response = (status: number, body: unknown): ApiResponse => ({ status, body });
const error = (status: number, code: string, message: string): ApiResponse => response(status, {
  ok: false,
  error: { code, message },
});
const record = (value: unknown, name: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
};
const required = (query: URLSearchParams, key: string): string => {
  const value = query.get(key)?.trim();
  if (!value) throw new Error(`${key} query parameter is required`);
  return value;
};
const unix = (query: URLSearchParams, key: string, requiredValue: boolean): number | null => {
  const value = query.get(key);
  if (value === null || value.trim().length === 0) {
    if (requiredValue) throw new Error(`${key} query parameter is required`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${key} must be a non-negative Unix timestamp`);
  return parsed;
};

const inputFailure = (cause: unknown): ApiResponse => {
  if (cause instanceof CalculationUnavailableError) {
    return error(422, "calculation_unavailable", cause.message);
  }
  if (cause instanceof Error && /Birth|birth|place|time|date|Unknown city|Unknown country|Unknown region/u.test(cause.message)) {
    return error(400, "invalid_calculation_input", cause.message);
  }
  return error(500, "calculation_failed", "Calculation failed");
};

const calculation = async (request: ApiRequest, runtime: ApiRuntime): Promise<ApiResponse> => {
  let parsed;
  try {
    parsed = parseCalculationRequest(request.body, runtime.options);
  } catch (cause) {
    return error(400, "invalid_request", cause instanceof Error ? cause.message : "Invalid request");
  }
  try {
    return response(200, {
      ok: true,
      calculation: await runtime.service.calculate(parsed.birth, parsed.options),
    });
  } catch (cause) {
    return inputFailure(cause);
  }
};

const generation = async (request: ApiRequest, runtime: ApiRuntime): Promise<ApiResponse> => {
  if (runtime.generator === null) {
    return error(503, "generation_not_configured", "Interpreted chart generation requires OPENAI_API_KEY");
  }
  let parsed;
  try {
    parsed = parseCalculationRequest(request.body, runtime.options);
  } catch (cause) {
    return error(400, "invalid_request", cause instanceof Error ? cause.message : "Invalid request");
  }
  const latest: { value: ChartBill | null } = { value: null };
  try {
    const generated = await runtime.generator.generate(parsed.birth, parsed.options, {
      onBill: (bill) => {
        latest.value = bill;
        runtime.bills?.live(bill);
      },
    });
    const bill = generated.bill ?? latest.value;
    if (bill !== null) await runtime.bills?.save(bill);
    return response(200, {
      ok: true,
      file: generated.file,
      ...(bill === null ? {} : { bill }),
    });
  } catch (cause) {
    const bill = latest.value;
    if (bill !== null && bill.status !== "running") await runtime.bills?.save(bill);
    const input = inputFailure(cause);
    if (input.status !== 500) return input;
    return error(502, "interpretation_failed", cause instanceof Error ? cause.message : "Interpreted chart generation failed");
  }
};

const trustedAuthority = (value: unknown, index: number): TrustedAuthority => {
  const raw = record(value, `trustedAuthorities[${index}]`);
  const issuer = raw["issuer"];
  const keyId = raw["keyId"];
  const publicKey = raw["publicKey"];
  const status = raw["status"];
  if (typeof issuer !== "string" || issuer.trim().length === 0) throw new Error(`trustedAuthorities[${index}].issuer is required`);
  if (typeof keyId !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(keyId)) {
    throw new Error(`trustedAuthorities[${index}].keyId is invalid`);
  }
  if (typeof publicKey !== "string" || !/^base64url:[A-Za-z0-9_-]+$/u.test(publicKey)) {
    throw new Error(`trustedAuthorities[${index}].publicKey is invalid`);
  }
  if (status !== "active" && status !== "retired" && status !== "revoked") {
    throw new Error(`trustedAuthorities[${index}].status is invalid`);
  }
  return { issuer, keyId, publicKey, status };
};

const validation = async (request: ApiRequest): Promise<ApiResponse> => {
  try {
    const raw = record(request.body, "request");
    if (!("file" in raw)) throw new Error("request.file is required");
    const trustedRaw = raw["trustedAuthorities"];
    if (trustedRaw !== undefined && !Array.isArray(trustedRaw)) throw new Error("request.trustedAuthorities must be an array");
    const trusted = (trustedRaw ?? []).map(trustedAuthority);
    return response(200, {
      ok: true,
      validation: await validateAstralFile(raw["file"], trusted),
    });
  } catch (cause) {
    return error(400, "invalid_validation_request", cause instanceof Error ? cause.message : "Invalid validation request");
  }
};

const places = async (request: ApiRequest, runtime: ApiRuntime): Promise<ApiResponse> => {
  try {
    switch (request.path) {
      case "/v1/places/continents":
        return response(200, { ok: true, continents: await runtime.places.continents() });
      case "/v1/places/countries":
        return response(200, {
          ok: true,
          countries: await runtime.places.countries(request.query.get("continent")?.trim() || undefined),
        });
      case "/v1/places/regions":
        return response(200, { ok: true, regions: await runtime.places.regions(required(request.query, "country")) });
      case "/v1/places/cities":
        return response(200, {
          ok: true,
          cities: await runtime.places.cities(
            required(request.query, "country"),
            request.query.get("region")?.trim() || null,
            request.query.get("q")?.trim() || "",
          ),
        });
      case "/v1/places/place":
        return response(200, { ok: true, place: await runtime.places.get(required(request.query, "id")) });
      default:
        return error(404, "not_found", "Route not found");
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Place lookup failed";
    if (/required/u.test(message)) return error(400, "invalid_query", message);
    return error(404, "place_not_found", message);
  }
};

const billing = async (request: ApiRequest, runtime: ApiRuntime): Promise<ApiResponse> => {
  const bills = runtime.bills;
  if (bills === undefined) return error(503, "billing_not_configured", "Billing storage is not configured");
  try {
    switch (request.path) {
      case "/v1/billing":
        return response(200, { ok: true, summary: await bills.summary() });
      case "/v1/billing/live":
        return response(200, { ok: true, bills: bills.liveBills() });
      case "/v1/billing/bills":
        return response(200, { ok: true, bills: await bills.list() });
      case "/v1/billing/bill": {
        const bill = await bills.get(required(request.query, "id"));
        return bill === null ? error(404, "bill_not_found", "Bill not found") : response(200, { ok: true, bill });
      }
      case "/v1/billing/pricing":
        return response(200, { ok: true, pricing: openAiPriceCatalogue });
      case "/v1/billing/provider-costs": {
        const adminKey = runtime.openAiAdminKey ?? null;
        if (adminKey === null) {
          return error(503, "provider_costs_not_configured", "OPENAI_ADMIN_KEY is required for provider cost reconciliation");
        }
        const start = unix(request.query, "start_time", true) as number;
        const end = unix(request.query, "end_time", false);
        return response(200, {
          ok: true,
          costs: await fetchOpenAICosts(adminKey, start, end),
        });
      }
      default:
        return error(404, "not_found", "Route not found");
    }
  } catch (cause) {
    return error(400, "invalid_billing_request", cause instanceof Error ? cause.message : "Billing request failed");
  }
};

export const routeApi = async (request: ApiRequest, runtime: ApiRuntime): Promise<ApiResponse> => {
  const method = request.method.toUpperCase();
  if (method === "GET" && request.path === "/health") {
    return response(200, {
      ok: true,
      service: "astral-charts",
      version: runtime.version,
      interpretedGeneration: runtime.generator !== null,
      billing: runtime.bills !== undefined,
    });
  }
  if (request.path.startsWith("/v1/billing")) {
    if (method !== "GET") return error(405, "method_not_allowed", "Billing routes require GET");
    return billing(request, runtime);
  }
  if (request.path.startsWith("/v1/places/")) {
    if (method !== "GET") return error(405, "method_not_allowed", "Place routes require GET");
    return places(request, runtime);
  }
  if (request.path === "/v1/calculations") {
    if (method !== "POST") return error(405, "method_not_allowed", "Calculation route requires POST");
    return calculation(request, runtime);
  }
  if (request.path === "/v1/charts") {
    if (method !== "POST") return error(405, "method_not_allowed", "Chart generation requires POST");
    return generation(request, runtime);
  }
  if (request.path === "/v1/files/validate") {
    if (method !== "POST") return error(405, "method_not_allowed", "File validation requires POST");
    return validation(request);
  }
  return error(404, "not_found", "Route not found");
};
