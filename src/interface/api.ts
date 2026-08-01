import { CalculationUnavailableError, type CalculationOptions, type CalculationService } from "../calculate/service.js";
import type { PlaceCatalogue } from "../place/model.js";
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
  options: CalculationOptions;
  places: PlaceCatalogue;
  version: string;
}

const response = (status: number, body: unknown): ApiResponse => ({ status, body });
const error = (status: number, code: string, message: string): ApiResponse => response(status, {
  ok: false,
  error: { code, message },
});
const required = (query: URLSearchParams, key: string): string => {
  const value = query.get(key)?.trim();
  if (!value) throw new Error(`${key} query parameter is required`);
  return value;
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
    if (cause instanceof CalculationUnavailableError) {
      return error(422, "calculation_unavailable", cause.message);
    }
    if (cause instanceof Error && /Birth|birth|place|time|date|Unknown city|Unknown country|Unknown region/u.test(cause.message)) {
      return error(400, "invalid_calculation_input", cause.message);
    }
    return error(500, "calculation_failed", "Calculation failed");
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

export const routeApi = async (request: ApiRequest, runtime: ApiRuntime): Promise<ApiResponse> => {
  const method = request.method.toUpperCase();
  if (method === "GET" && request.path === "/health") {
    return response(200, { ok: true, service: "astral-charts", version: runtime.version });
  }
  if (request.path.startsWith("/v1/places/")) {
    if (method !== "GET") return error(405, "method_not_allowed", "Place routes require GET");
    return places(request, runtime);
  }
  if (request.path === "/v1/calculations") {
    if (method !== "POST") return error(405, "method_not_allowed", "Calculation route requires POST");
    return calculation(request, runtime);
  }
  return error(404, "not_found", "Route not found");
};
