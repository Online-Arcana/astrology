# Interpretation orchestration

`kitty-crow/openai-schema` is the sole OpenAI runtime. `astrology` does not construct Conversations API or Responses API requests and does not depend on a second OpenAI SDK.

The runtime path is:

```text
fixed interpretation plan
  -> astrology sequencing and local audit
  -> OpenAISchema.run(...)
  -> OpenAI Conversations and Responses APIs
```

## One conversation per chart

One chart job constructs one `OpenAISchema` instance through the local `SchemaClient` adapter. The library lazily creates one OpenAI conversation and attaches every subsequent schema call to that exact conversation.

After each call, `astrology` verifies that a conversation ID exists and has not changed. A missing or changed ID fails the chart. A later chart job constructs a new client, so conversations cannot be shared between charts.

The conversation ID is runtime state. It is not written into the calculation, interpreted chart or `.astral` file.

## Responsibility split

`openai-schema` owns:

- conversation creation
- Responses API transport
- attaching calls to the active conversation
- changing the strict JSON schema between fields
- extracting and parsing structured JSON output
- serialising queued calls on the same client

`astrology` owns:

- the fixed interpretation plan
- one cohesive schema field per call
- deterministic input projection
- model selection
- source-reference permissions
- local deterministic NLP audit
- safe mechanical repair
- narrow field retry
- progress and final chart assembly

There is no duplicate Responses API implementation in `astrology`.

## Field calls

Every `InterpretationCall` has:

- one stable ID and label
- one strict output schema
- one cohesive chart responsibility
- only the relevant deterministic source objects
- an explicit set of permitted local JSON references
- one recursive field audit

The LLM never selects fields, availability, placements, house systems, aspects, dignity, compatibility scores or ranks.

All substantive interpretation fields use `OPENAI_BIG_MODEL`. The small model is restricted to the generated three-word chart-name utility and future non-substantive utilities.

When the subject supplied no name, the utility runs in the same chart conversation after the substantive fields. It must return exactly three hyphenated words. Its temporary result is removed from the interpretation-unit map before strict chart assembly, while its call and retry counts remain in provenance.

## Unavailable fields

If every permitted deterministic source for an ordinary generic section is unavailable, the host constructs a deterministic `status: unavailable` section and makes no LLM call.

Specialised fields and synthesis units must retain at least one available deterministic source. Their absence is a calculation or plan error rather than an invitation for the model to improvise.

## Audit and retries

The strict schema parser validates structure first. Local NLP audit then examines every substantive string and string-array item, including specialised romance, sexuality, career, money, compatibility and synthesis fields.

Audit checks include:

- process narration and boilerplate
- disclaimers
- placeholders
- forbidden formatting
- semantic relevance
- duplicate list entries
- near-duplication across interpretation fields
- local source-reference resolution
- source-reference permission and deterministic availability

A failed audit retries only that interpretation unit. The retry receives the exact audit failures and must return the same strict schema. Broad parse retries inside `openai-schema` remain disabled so semantic retry scope stays under host control.

## Transport options

The adapter passes the configured model, reasoning effort, output-token limit, `store: false`, developer instructions and metadata into `OpenAISchema.run(...)`. The library adds the strict JSON schema and active conversation itself.

Ordinary tests use fake clients or an injected fake `fetch`. They verify the real request shape without contacting OpenAI.
