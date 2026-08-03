const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export interface OpenAICostResult {
  startTime: number;
  endTime: number;
  amountUsd: number;
  projectId: string | null;
  lineItem: string | null;
}

export const fetchOpenAICosts = async (
  adminKey: string,
  startTime: number,
  endTime: number | null = null,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<OpenAICostResult[]> => {
  if (adminKey.trim().length === 0) throw new Error("OPENAI_ADMIN_KEY is required for provider cost reconciliation");
  if (!Number.isSafeInteger(startTime) || startTime < 0) throw new Error("start_time must be a non-negative Unix timestamp");
  if (endTime !== null && (!Number.isSafeInteger(endTime) || endTime <= startTime)) {
    throw new Error("end_time must be later than start_time");
  }

  const result: OpenAICostResult[] = [];
  let page: string | null = null;
  do {
    const query = new URLSearchParams({
      start_time: String(startTime),
      limit: "180",
      "group_by[]": "project_id",
    });
    query.append("group_by[]", "line_item");
    if (endTime !== null) query.set("end_time", String(endTime));
    if (page !== null) query.set("page", page);
    const response = await fetcher(`https://api.openai.com/v1/organization/costs?${query}`, {
      headers: { authorization: `Bearer ${adminKey}`, "content-type": "application/json" },
    });
    if (!response.ok) throw new Error(`OpenAI Costs API failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const value: unknown = await response.json();
    if (!object(value) || !Array.isArray(value["data"])) throw new Error("OpenAI Costs API returned an invalid page");
    for (const bucket of value["data"]) {
      if (!object(bucket) || !Array.isArray(bucket["results"])) continue;
      const bucketStart = typeof bucket["start_time"] === "number" ? bucket["start_time"] : 0;
      const bucketEnd = typeof bucket["end_time"] === "number" ? bucket["end_time"] : bucketStart;
      for (const entry of bucket["results"]) {
        if (!object(entry) || !object(entry["amount"])) continue;
        const amount = entry["amount"]["value"];
        if (typeof amount !== "number" || !Number.isFinite(amount)) continue;
        result.push({
          startTime: bucketStart,
          endTime: bucketEnd,
          amountUsd: amount,
          projectId: typeof entry["project_id"] === "string" ? entry["project_id"] : null,
          lineItem: typeof entry["line_item"] === "string" ? entry["line_item"] : null,
        });
      }
    }
    page = value["has_more"] === true && typeof value["next_page"] === "string" ? value["next_page"] : null;
  } while (page !== null);
  return result;
};
