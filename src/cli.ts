#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { readConfig } from "./config.js";
import { encodeAstralFile } from "./file/validate.js";
import { routeApi, type ApiRequest, type ApiResponse } from "./interface/api.js";
import { cliHelp, parseCliArgs, type PlaceCommand } from "./interface/cliArgs.js";
import { loadApiRuntime } from "./interface/runtime.js";
import { listenAstralServer } from "./interface/server.js";
import type { AstralFile, TrustedAuthority } from "./types/file.js";

const readStdin = async (): Promise<string> => {
  let text = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) text += chunk;
  return text;
};

const readText = async (path: string): Promise<string> => path === "-" ? readStdin() : readFile(path, "utf8");
const writeText = async (path: string, text: string): Promise<void> => {
  if (path === "-") {
    process.stdout.write(text);
    return;
  }
  await writeFile(path, text, "utf8");
};

const parseJson = (text: string, name: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new Error(`${name} is not valid JSON`, { cause });
  }
};

const output = async (path: string, result: ApiResponse): Promise<void> => {
  await writeText(path, `${JSON.stringify(result.body, null, 2)}\n`);
  if (result.status < 200 || result.status >= 300) process.exitCode = 1;
};

const calculationBody = (value: unknown, overrides: Record<string, unknown>): unknown => {
  if (Object.keys(overrides).length === 0) return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const request = value as Record<string, unknown>;
  const current = typeof request["options"] === "object" && request["options"] !== null && !Array.isArray(request["options"])
    ? request["options"] as Record<string, unknown>
    : {};
  return { ...request, options: { ...current, ...overrides } };
};

const placeRequest = (command: PlaceCommand): ApiRequest => {
  const query = new URLSearchParams();
  let path: string;
  switch (command.action) {
    case "continents":
      path = "/v1/places/continents";
      break;
    case "countries":
      path = "/v1/places/countries";
      if (command.continent) query.set("continent", command.continent);
      break;
    case "regions":
      path = "/v1/places/regions";
      query.set("country", command.country);
      break;
    case "cities":
      path = "/v1/places/cities";
      query.set("country", command.country);
      if (command.region) query.set("region", command.region);
      if (command.query) query.set("q", command.query);
      break;
    case "get":
      path = "/v1/places/place";
      query.set("id", command.id);
      break;
  }
  return { method: "GET", path, query, body: null };
};

const trustedAuthorities = async (path: string | null): Promise<TrustedAuthority[]> => {
  if (path === null) return [];
  const value = parseJson(await readText(path), "Trusted-authority file");
  if (Array.isArray(value)) return value as TrustedAuthority[];
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const list = (value as { trustedAuthorities?: unknown }).trustedAuthorities;
    if (Array.isArray(list)) return list as TrustedAuthority[];
  }
  throw new Error("Trusted-authority file must contain an array or a trustedAuthorities array");
};

export const runCli = async (args: readonly string[]): Promise<void> => {
  const command = parseCliArgs(args);
  if (command.kind === "help") {
    process.stdout.write(cliHelp);
    return;
  }

  const config = readConfig(process.env);
  const runtime = await loadApiRuntime(config, "0.16.3");

  if (command.kind === "calculate" || command.kind === "generate") {
    const body = calculationBody(
      parseJson(await readText(command.input), "Input"),
      command.optionOverrides,
    );
    const result = await routeApi({
      method: "POST",
      path: command.kind === "calculate" ? "/v1/calculations" : "/v1/charts",
      query: new URLSearchParams(),
      body,
    }, runtime);
    if (command.kind === "calculate" || result.status < 200 || result.status >= 300) {
      await output(command.output, result);
      return;
    }
    const file = (result.body as { file?: unknown }).file as AstralFile | undefined;
    if (!file) throw new Error("Chart generation returned no astral file");
    await writeText(command.output, encodeAstralFile(file, command.pretty));
    return;
  }

  if (command.kind === "validate") {
    const file = parseJson(await readText(command.input), "Astral file");
    const trusted = await trustedAuthorities(command.trusted);
    const result = await routeApi({
      method: "POST",
      path: "/v1/files/validate",
      query: new URLSearchParams(),
      body: { file, trustedAuthorities: trusted },
    }, runtime);
    await output(command.output, result);
    if (result.status >= 200 && result.status < 300) {
      const validation = (result.body as { validation?: { structure?: string; integrity?: string; authority?: string } }).validation;
      const valid = validation?.structure === "valid"
        && validation.integrity === "valid"
        && validation.authority !== "invalid"
        && validation.authority !== "unknown_key"
        && validation.authority !== "revoked";
      if (!valid) process.exitCode = 1;
    }
    return;
  }

  if (command.kind === "places") {
    await output("-", await routeApi(placeRequest(command.command), runtime));
    return;
  }

  const { server, address } = await listenAstralServer(runtime, {
    host: command.host,
    port: command.port,
    bodyLimitBytes: command.bodyLimitBytes,
  });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    service: "astral-charts",
    host: address.address,
    port: address.port,
    interpretedGeneration: runtime.generator !== null,
  })}\n`);
  const close = (): void => {
    server.close((cause) => {
      if (cause) {
        process.stderr.write(`${cause.message}\n`);
        process.exitCode = 1;
      }
    });
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
};

void runCli(process.argv.slice(2)).catch((cause) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  process.stderr.write(`${JSON.stringify({ ok: false, error: { code: "cli_failed", message } })}\n`);
  process.exitCode = 1;
});
