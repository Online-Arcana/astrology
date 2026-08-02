import { createOpenAISchemaClientFactory } from "../src/llm/openaiSchema.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const requests: Array<{ method: string; url: string }> = [];
let uploadPurpose: FormDataEntryValue | null = null;
let uploadName: string | null = null;

const fakeFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  const method = String(init?.method ?? "GET").toUpperCase();
  requests.push({ method, url });

  if (method === "POST" && url.endsWith("/files")) {
    assert(init?.body instanceof FormData, "snapshot upload must use multipart form data");
    uploadPurpose = init.body.get("purpose");
    const file = init.body.get("file");
    assert(file instanceof File, "snapshot upload must include a file");
    uploadName = file.name;
    equal(file.type, "application/json", "snapshot content type");
    equal(await file.text(), '{"accepted":true}', "snapshot content");
    return new Response(JSON.stringify({ id: "file_snapshot" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  if (method === "GET" && url.endsWith("/responses/resp_partial")) {
    return new Response(JSON.stringify({
      id: "resp_partial",
      status: "incomplete",
      output: [{ type: "message", content: [{ type: "output_text", text: "partial result" }] }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  if (method === "DELETE" && url.endsWith("/files/file_snapshot")) {
    return new Response(JSON.stringify({ id: "file_snapshot", deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  if (method === "DELETE" && url.endsWith("/files/missing")) {
    return new Response("not found", { status: 404 });
  }

  throw new Error(`Unexpected OpenAI request: ${method} ${url}`);
};

const factory = createOpenAISchemaClientFactory({
  apiKey: "test-key",
  instructions: "Return only the strict schema.",
  base: "https://example.invalid/v1",
  fetch: fakeFetch,
  transport: { background: false },
});
const client = factory();
assert(client.uploadFile !== undefined, "schema client must expose snapshot upload");
assert(client.retrieveResponse !== undefined, "schema client must expose response retrieval");
assert(client.deleteFile !== undefined, "schema client must expose snapshot deletion");

const uploaded = await client.uploadFile("snapshot.json", '{"accepted":true}');
equal(uploaded.id, "file_snapshot", "uploaded file ID");
equal(uploaded.purpose, "user_data", "uploaded file purpose");
equal(uploadPurpose, "user_data", "multipart purpose");
equal(uploadName, "snapshot.json", "multipart filename");

const partial = await client.retrieveResponse("resp_partial") as { status?: string };
equal(partial.status, "incomplete", "retrieved response status");

await client.deleteFile("file_snapshot");
await client.deleteFile("missing");

equal(requests.filter(({ method }) => method === "POST").length, 1, "one file upload request");
equal(requests.filter(({ method }) => method === "GET").length, 1, "one response retrieval request");
equal(requests.filter(({ method }) => method === "DELETE").length, 2, "two idempotent delete requests");

console.log("1..1");
