#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { readConfig } from "./config.js";
import { encodeAstralFile } from "./file/validate.js";
import { routeApi } from "./interface/api.js";
import { cliHelp, parseCliArgs } from "./interface/cliArgs.js";
import { parseCalculationRequest } from "./interface/request.js";
import { loadApiRuntime } from "./interface/runtime.js";
import { listenAstralServer } from "./interface/server.js";
const readStdin = async () => {
    let text = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin)
        text += chunk;
    return text;
};
const readText = async (path) => path === "-" ? readStdin() : readFile(path, "utf8");
const writeText = async (path, text) => {
    if (path === "-") {
        process.stdout.write(text);
        return;
    }
    await writeFile(path, text, "utf8");
};
const parseJson = (text, name) => {
    try {
        return JSON.parse(text);
    }
    catch (cause) {
        throw new Error(`${name} is not valid JSON`, { cause });
    }
};
const output = async (path, result) => {
    await writeText(path, `${JSON.stringify(result.body, null, 2)}\n`);
    if (result.status < 200 || result.status >= 300)
        process.exitCode = 1;
};
const calculationBody = (value, overrides) => {
    if (Object.keys(overrides).length === 0)
        return value;
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return value;
    const request = value;
    const current = typeof request["options"] === "object" && request["options"] !== null && !Array.isArray(request["options"])
        ? request["options"]
        : {};
    return { ...request, options: { ...current, ...overrides } };
};
const placeRequest = (command) => {
    const query = new URLSearchParams();
    let path;
    switch (command.action) {
        case "continents":
            path = "/v1/places/continents";
            break;
        case "countries":
            path = "/v1/places/countries";
            if (command.continent)
                query.set("continent", command.continent);
            break;
        case "regions":
            path = "/v1/places/regions";
            query.set("country", command.country);
            break;
        case "cities":
            path = "/v1/places/cities";
            query.set("country", command.country);
            if (command.region)
                query.set("region", command.region);
            if (command.query)
                query.set("q", command.query);
            break;
        case "get":
            path = "/v1/places/place";
            query.set("id", command.id);
            break;
    }
    return { method: "GET", path, query, body: null };
};
const trustedAuthorities = async (path) => {
    if (path === null)
        return [];
    const value = parseJson(await readText(path), "Trusted-authority file");
    if (Array.isArray(value))
        return value;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const list = value.trustedAuthorities;
        if (Array.isArray(list))
            return list;
    }
    throw new Error("Trusted-authority file must contain an array or a trustedAuthorities array");
};
const money = (value) => value === null ? "unpriced" : `$${value.toFixed(6)}`;
const tokens = (value) => new Intl.NumberFormat("en-GB").format(value);
const bar = (value, maximum, width = 22) => {
    const ratio = maximum <= 0 ? 0 : Math.min(1, value / maximum);
    const filled = Math.round(width * ratio);
    return `[${"█".repeat(filled)}${"░".repeat(width - filled)}]`;
};
const groupLine = (group) => `${group.key}: ${tokens(group.totalTokens)} tokens · ${tokens(group.inputTokens)} in · ${tokens(group.outputTokens)} out · ${money(group.costUsd)}`;
class BillView {
    #limit;
    #average;
    #lines = 0;
    constructor(limit, average) {
        this.#limit = limit;
        this.#average = average;
    }
    draw(bill) {
        if (!process.stderr.isTTY)
            return;
        const lines = [
            `Chart cost ${money(bill.total.costUsd)} · ${tokens(bill.total.totalTokens)} tokens · historical average ${money(this.#average)}`,
            ...bill.byLane.map((lane) => `${bar(lane.totalTokens, this.#limit)} ${groupLine(lane)}`),
            "By model:",
            ...bill.byModel.map((model) => `  ${groupLine(model)}`),
        ];
        if (this.#lines > 0)
            process.stderr.write(`\u001b[${this.#lines}A`);
        for (const line of lines)
            process.stderr.write(`\u001b[2K${line}\n`);
        for (let index = lines.length; index < this.#lines; index += 1)
            process.stderr.write("\u001b[2K\n");
        if (this.#lines > lines.length)
            process.stderr.write(`\u001b[${this.#lines - lines.length}A`);
        this.#lines = Math.max(this.#lines, lines.length);
    }
    finish(bill) {
        this.draw(bill);
        if (!process.stderr.isTTY) {
            process.stderr.write(`${JSON.stringify({ billing: bill })}\n`);
            return;
        }
        process.stderr.write(`Final chart cost: ${money(bill.total.costUsd)} across ${tokens(bill.total.totalTokens)} tokens.\n`);
    }
}
export const runCli = async (args) => {
    const command = parseCliArgs(args);
    if (command.kind === "help") {
        process.stdout.write(cliHelp);
        return;
    }
    const config = readConfig(process.env);
    const runtime = await loadApiRuntime(config, "0.20.0");
    if (command.kind === "bills") {
        await writeText(command.output, `${JSON.stringify(await runtime.bills.summary(), null, 2)}\n`);
        return;
    }
    if (command.kind === "calculate" || command.kind === "generate") {
        const body = calculationBody(parseJson(await readText(command.input), "Input"), command.optionOverrides);
        if (command.kind === "calculate") {
            await output(command.output, await routeApi({
                method: "POST",
                path: "/v1/calculations",
                query: new URLSearchParams(),
                body,
            }, runtime));
            return;
        }
        if (runtime.generator === null)
            throw new Error("Interpreted chart generation requires OPENAI_API_KEY");
        const parsed = parseCalculationRequest(body, runtime.options);
        const history = await runtime.bills.summary();
        const view = new BillView(config.chart.laneContextTokens ?? 60_000, history.averageCompletedChartCostUsd);
        const latest = { value: null };
        try {
            const generated = await runtime.generator.generate(parsed.birth, parsed.options, {
                onBill: (bill) => {
                    latest.value = bill;
                    runtime.bills.live(bill);
                    view.draw(bill);
                },
            });
            const bill = generated.bill ?? latest.value;
            if (bill !== null) {
                await runtime.bills.save(bill);
                view.finish(bill);
            }
            // Final customer-facing .astral files are always indented. Recovery snapshots remain compact.
            await writeText(command.output, encodeAstralFile(generated.file, true));
            return;
        }
        catch (cause) {
            const bill = latest.value;
            if (bill !== null && bill.status !== "running") {
                await runtime.bills.save(bill);
                view.finish(bill);
            }
            throw cause;
        }
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
            const validation = result.body.validation;
            const valid = validation?.structure === "valid"
                && validation.integrity === "valid"
                && validation.authority !== "invalid"
                && validation.authority !== "unknown_key"
                && validation.authority !== "revoked";
            if (!valid)
                process.exitCode = 1;
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
        billing: true,
    })}\n`);
    const close = () => {
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
//# sourceMappingURL=cli.js.map