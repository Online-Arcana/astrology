import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { routeApi, type ApiRequest, type ApiRuntime } from "./api.js";

export interface HttpServerOptions {
  host: string;
  port: number;
  bodyLimitBytes: number;
}

const defaults: HttpServerOptions = {
  host: "127.0.0.1",
  port: 8787,
  bodyLimitBytes: 1_048_576,
};

const json = (response: ServerResponse, status: number, body: unknown): void => {
  const encoded = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("content-length", Buffer.byteLength(encoded));
  response.end(encoded);
};

const readBody = async (request: IncomingMessage, limit: number): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.byteLength;
    if (length > limit) throw new Error("request_body_too_large");
    chunks.push(value);
  }
  if (chunks.length === 0) return null;
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
};

const requestValue = async (
  request: IncomingMessage,
  options: HttpServerOptions,
): Promise<ApiRequest> => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const method = request.method ?? "GET";
  const needsBody = method.toUpperCase() === "POST" || method.toUpperCase() === "PUT" || method.toUpperCase() === "PATCH";
  if (needsBody) {
    const contentType = request.headers["content-type"] ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) throw new Error("json_content_type_required");
  }
  return {
    method,
    path: url.pathname,
    query: url.searchParams,
    body: needsBody ? await readBody(request, options.bodyLimitBytes) : null,
  };
};

const handler = (
  runtime: ApiRuntime,
  options: HttpServerOptions,
) => async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  try {
    const result = await routeApi(await requestValue(request, options), runtime);
    json(response, result.status, result.body);
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "request_failed";
    if (code === "request_body_too_large") {
      json(response, 413, { ok: false, error: { code, message: "Request body exceeds the configured limit" } });
      return;
    }
    if (code === "invalid_json") {
      json(response, 400, { ok: false, error: { code, message: "Request body is not valid JSON" } });
      return;
    }
    if (code === "json_content_type_required") {
      json(response, 415, { ok: false, error: { code, message: "JSON requests require application/json" } });
      return;
    }
    json(response, 500, { ok: false, error: { code: "request_failed", message: "Request failed" } });
  }
};

export const createAstralServer = (
  runtime: ApiRuntime,
  input: Partial<HttpServerOptions> = {},
): { server: Server; options: HttpServerOptions } => {
  const options = { ...defaults, ...input };
  if (!Number.isSafeInteger(options.port) || options.port < 0 || options.port > 65_535) throw new Error("Port must be between 0 and 65535");
  if (!Number.isSafeInteger(options.bodyLimitBytes) || options.bodyLimitBytes < 1) throw new Error("Body limit must be positive");
  if (options.host.trim().length === 0) throw new Error("Host must not be empty");
  return { server: createServer(handler(runtime, options)), options };
};

export const listenAstralServer = async (
  runtime: ApiRuntime,
  input: Partial<HttpServerOptions> = {},
): Promise<{ server: Server; address: AddressInfo }> => {
  const { server, options } = createAstralServer(runtime, input);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("HTTP server did not expose a TCP address");
  return { server, address };
};
